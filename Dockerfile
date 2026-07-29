# syntax=docker/dockerfile:1

# Debian rather than Alpine: bcrypt is a native module and ships prebuilt
# binaries for glibc, so musl would force a compile toolchain into the image.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The postinstall hook runs prisma generate, which needs the schema and config.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle while building, so the
# first weekday and the demo button have to be known here and cannot be changed
# at startup.
ARG NEXT_PUBLIC_WEEK_START_DAY=1
ENV NEXT_PUBLIC_WEEK_START_DAY=$NEXT_PUBLIC_WEEK_START_DAY
ARG NEXT_PUBLIC_DEMO_LOGIN=false
ENV NEXT_PUBLIC_DEMO_LOGIN=$NEXT_PUBLIC_DEMO_LOGIN
# Collecting page data imports the route modules, and they validate the server
# configuration on import. The values only have to exist: nothing connects to a
# database during a build, and the real ones arrive from compose at startup.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV SESSION_SECRET=build-time-placeholder-not-used-at-runtime
# prisma generate is repeated because the copy above replaced the client from
# deps. Pruning happens here, not in the runner: deleting files in a later layer
# leaves them in the earlier one and the image keeps their weight.
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force \
  && rm -rf .next/cache

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# The build stage already dropped the toolchain that has no job at runtime.
# Prisma, tsx and dotenv stay because the entrypoint runs migrations and the seed.
COPY --from=build --chown=node:node /app ./
RUN chmod +x docker/entrypoint.sh
# Never run as root.
USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["npm", "start"]
