import { spawn, execSync, type ChildProcess } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { TEST_DATABASE_URL } from "../helpers/db";

const PORT = Number(process.env.TEST_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 120_000;

const DB_HINT =
  "Integration tests need Postgres. Start it with: docker compose up -d";

/** Connection string for the maintenance database, used only to create ours. */
function adminUrl() {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

function testDatabaseName() {
  return new URL(TEST_DATABASE_URL).pathname.replace("/", "");
}

async function createTestDatabase() {
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl() }),
  });

  try {
    await admin.$queryRaw`SELECT 1`;
  } catch {
    await admin.$disconnect();
    throw new Error(DB_HINT);
  }

  try {
    // CREATE DATABASE cannot run inside a transaction, hence the raw call.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabaseName()}"`);
  } catch (error) {
    // 42P04 is "database already exists", which is the normal case on a rerun.
    const code = (error as { meta?: { code?: string } }).meta?.code;
    const message = (error as Error).message ?? "";
    if (code !== "42P04" && !message.includes("already exists")) {
      throw error;
    }
  } finally {
    await admin.$disconnect();
  }
}

async function waitForServer(server: ChildProcess, output: () => string) {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      // Without its output the failure is unexplainable, so it travels with the error.
      throw new Error(
        `Test server exited early with code ${server.exitCode}:\n${output()}`,
      );
    }

    try {
      // Any answer means the routes are compiled and serving; a guest gets 401.
      const response = await fetch(`${BASE_URL}/api/auth/me`);
      if (response.status === 401) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Test server did not become ready within ${READY_TIMEOUT_MS}ms`,
  );
}

export default async function setup() {
  await createTestDatabase();

  // migrate deploy, not dev: it only applies existing migrations and never
  // prompts or rewrites history.
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  // The application under test runs as its own process against the test
  // database. Variables passed here win over the .env file, so the dev database
  // is never touched.
  const server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "integration-test-secret-value",
      // The suite creates a new account for almost every test, which is far
      // more than the production ceiling on registrations is meant to allow.
      REGISTER_LIMIT: "1000",
      NODE_ENV: "development",
      // Its own build directory, so the tests can run while a dev server is up:
      // Next refuses to start a second dev server sharing one.
      NEXT_DIST_DIR: ".next-test",
    },
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  let log = "";
  const collect = (chunk: Buffer) => {
    log = `${log}${chunk.toString()}`.slice(-2000);
  };
  server.stdout?.on("data", collect);
  server.stderr?.on("data", collect);

  await waitForServer(server, () => log);

  return async () => {
    if (server.pid === undefined) {
      return;
    }

    // On Windows the spawned shell is the parent of the real server process, so
    // killing the child alone would leave the port occupied.
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  };
}
