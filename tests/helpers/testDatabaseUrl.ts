// Integration tests run against their own database so a failing test can never
// wipe the data a developer is looking at in the dev database.
//
// It lives in a module of its own, without the client that db.ts builds around
// it, because vitest.integration.config.ts reads it to put DATABASE_URL into
// the test environment — and a config file must not open a connection pool.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/meeting_room_booking_test?schema=public";
