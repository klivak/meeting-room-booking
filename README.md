# Meeting Room Booking

[Українська версія](README.uk.md)

A web application for booking meeting rooms in an office. Users see a room's weekly schedule, book free slots, and edit or cancel only their own bookings. Other users' bookings remain visible with the author's name, but cannot be changed through either the interface or direct API requests.

Stack: Next.js (App Router) + TypeScript, Prisma + PostgreSQL, Tailwind CSS, Luxon, Zod, bcrypt, Vitest, and next-intl.

The interface and API messages are available in Ukrainian and English. Light and dark themes can be switched in the header.

## Run with Docker

Only Docker is required. One command starts the database and application, applies migrations, and runs the seed:

```bash
cp .env.example .env
docker compose up --build
```

Then open http://localhost:3000. The first start takes a few minutes while the image is built; later starts take about ten seconds.

## Run with npm

Node 20+ and Docker for the database are required.

```bash
cp .env.example .env
docker compose up -d db     # PostgreSQL only, on localhost:5432
npm install                 # postinstall generates Prisma Client
npx prisma migrate dev      # create the schema
npx prisma db seed          # rooms, users, and demo bookings
npm run dev                 # http://localhost:3000
```

The seed is idempotent: running it again does not duplicate data or overwrite a password you changed. Demo bookings are tied to the current week, so they do not become stale.

## Test Users

| Email               | Password      | Name        |
| ------------------- | ------------- | ----------- |
| `alice@example.com` | `password123` | Alisa Test  |
| `bob@example.com`   | `password123` | Bohdan Demo |

Both users have seeded bookings. Sign in as either one to see both owned and foreign bookings; the other user's entries have no action buttons.

With `NEXT_PUBLIC_DEMO_LOGIN=true`, as in `.env.example`, the login page includes a button that fills the form with the first demo account. Keep this variable disabled in any real environment.

See `docs/demo.md` for a step-by-step product walkthrough, including features that are not visible by default: another timezone, the mobile view, email verification, notifications, and recurring bookings.

## Commands

| Command                             | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                       | Development server                                                             |
| `npm run build`                     | Production build                                                               |
| `npm run verify`                    | Types, ESLint, formatting, unit tests, and integration tests                   |
| `npm test`                          | Unit tests followed by integration tests                                       |
| `npm run test:unit`                 | Unit tests only, without a database                                            |
| `npm run test:integration`          | API integration tests only                                                     |
| `npm run typecheck`                 | Type checking                                                                  |
| `npm run lint`                      | ESLint                                                                         |
| `npm run format`                    | Format with Prettier                                                           |
| `npm run format:check`              | Check formatting with Prettier                                                 |
| `npm run e2e`                       | Run Playwright through live screens and save screenshots to `e2e/screenshots/` |
| `npm run db:up` / `npm run db:down` | Start or stop PostgreSQL                                                       |
| `npm run db:migrate`                | Create and apply a migration in development                                    |
| `npm run db:deploy`                 | Apply existing migrations in production                                        |
| `npm run db:seed`                   | Seed rooms, users, and demo bookings                                           |
| `npm run db:reset`                  | Reset the database, reapply migrations, and seed                               |
| `npm run db:studio`                 | Prisma Studio                                                                  |

## Tests

`npm test` runs 123 unit tests and 59 integration tests.

Unit tests in `src/**/*.test.ts` cover domain rules: interval overlap, working hours across daylight-saving transitions, time granularity, duration, future-only creation, weekly-grid geometry, locale selection from `Accept-Language`, schema message keys, email normalization, and password hashing. They do not require a database. The race-condition test exercises PostgreSQL locking and runs with the integration suite.

Integration tests in `tests/api/`, plus the race test, exercise the real application over HTTP. `globalSetup` creates a separate `meeting_room_booking_test` database, applies migrations, and starts the application on port 3100. The working database is not modified. The suite covers authentication, booking validation failures, ownership enforcement, login throttling, hashed verification tokens, and stable pagination of the user's bookings.

The integration suite requires a running database and suggests `docker compose up -d` when it cannot connect. The unit suite works without a database.

`npm run verify` runs type checking, ESLint, formatting checks, and both test suites. It should be green before delivery.

The `.githooks/pre-commit` hook runs Prettier and ESLint only for files in the commit. `npm install` configures the hook path through the `prepare` script. Type checking and tests remain the responsibility of `npm run verify` at the end of a stage.

The sole correctness-oriented e2e exception is `e2e/overflow.spec.ts`, which verifies that a page is not wider than its viewport. Playwright otherwise serves as a visual walkthrough: it opens live screens and captures 1366×768, 768, and 360 screenshots in light and dark themes. Run `docker compose up -d` and `npx tsx prisma/seed.ts` first.

## How Overlap Checking Works

A booking is a half-open interval `[start, end)`: its starting minute belongs to it, while its ending minute does not. Two bookings for the same room conflict exactly when `A.start < B.end && B.start < A.end`. Strict comparisons make adjacent bookings legal, so `10:00–11:00` and `11:00–12:00` can coexist, while partial overlap, exact matches, and containment remain conflicts.

The rule intentionally exists in two forms. The pure `intervalsOverlap` function in `src/lib/domain/overlap.ts` is tested and used for intervals already in memory. The same expression appears in the database query in `src/lib/server/bookings.ts`, because loading every room booking just to check overlap would be wasteful. Canceled bookings are excluded with `canceledAt IS NULL`.

The check and insert happen in one transaction under `pg_advisory_xact_lock`; otherwise two concurrent requests could both observe the slot as free.

## How Time Is Stored

The database stores UTC only through Prisma `DateTime`. Working hours, 09:00–19:00, are always validated in the office timezone `Europe/Kyiv`, regardless of the user's location. Luxon uses IANA timezone rules, so daylight-saving changes are handled automatically.

The interface displays time in the browser timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Grid rows remain tied to office time, while axis labels show the same instants in the user's timezone. The timezone notice below the room name explains the offset and office hours, and becomes visually prominent outside Kyiv time.

Server rendering initially uses office time and replaces it with browser-local values after hydration, avoiding server/client markup mismatches.

## Implemented Bonuses

| Bonus                                   | Status | Where to look                                                                                |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| BONUS-1 Full application Docker Compose | ✅     | `Dockerfile`, `docker/entrypoint.sh`, `docker-compose.yml`                                   |
| BONUS-4 Race-condition protection       | ✅     | `src/lib/server/bookings.ts`, `bookings.race.test.ts`                                        |
| BONUS-6 API integration tests           | ✅     | `tests/api/`                                                                                 |
| BONUS-7 Room capacity filter            | ✅     | Home page, `GET /api/rooms?capacityMin=`                                                     |
| BONUS-2 Development email verification  | ✅     | `src/lib/server/verification.ts`, `VerificationBanner.tsx`                                   |
| BONUS-3 Weekly recurring bookings       | ✅     | `src/lib/domain/recurrence.ts`, `src/lib/server/bookings.ts`                                 |
| BONUS-5 End-of-booking notifications    | ✅     | `src/lib/domain/notifications.ts`, `src/lib/server/notifications.ts`, `NotificationBell.tsx` |
| BONUS-8 Complete mobile flow            | ✅     | `src/components/schedule/Schedule.tsx`, `SwipeArea.tsx`                                      |

### Weekly Recurring Bookings

The creation form can repeat a booking weekly from 2 to 12 times. Weeks are added in office time rather than as fixed 7×24-hour durations, preserving wall-clock time across daylight-saving transitions. Every occurrence passes the same validation rules.

Creation is all-or-nothing in one transaction. A conflict response names the affected dates. Users can cancel one occurrence or the remaining series; series cancellation never rewrites the past. A single canceled booking offers a short undo window, but restoration reacquires the advisory lock and can return 409 if another user has taken the slot.

Editing deliberately affects one occurrence only. To move a whole series, cancel it and create a replacement.

### Email Verification

Registration creates a one-time token and prints the verification link in the server log, so development does not require SMTP. The link uses `SITE_URL`, not the request's `Host` header. Until verification, booking creation and editing return `403 EMAIL_NOT_VERIFIED`; cancellation remains allowed because it only releases a slot.

Tokens are single-use. Resending deletes the previous token, and the database stores only a SHA-256 hash of the random 32-byte value. Seeded users are already verified.

### End-of-Booking Notifications

When another booking begins immediately after yours, the header shows a bell and a one-time toast `NOTIFY_BEFORE_MINUTES` before the end. Nothing is shown when the following slot is free. Notifications become read through the explicit “Mark all as read” action.

The tested `isEndingNotificationDue` function requires both bookings to be active and exactly adjacent. Notifications are calculated when the client polls rather than by a background timer. A unique `(bookingId, type)` index guarantees at-most-once creation under concurrent requests.

For a manual demonstration, set a large value such as `NOTIFY_BEFORE_MINUTES=600`, create adjacent bookings in one room as different users, and open the app as the first author.

### Mobile View

Seven columns are unreadable on a phone, so below the `sm` breakpoint the schedule shows one day with arrows, a weekday ribbon, and horizontal swipe navigation. The selected day lives in `?day=`, and crossing a week boundary navigates to the adjacent week.

Both desktop and mobile views are rendered and CSS chooses between them. Shared geometry helpers keep their cells and booking blocks consistent without a hydration layout jump.

### Why an Advisory Lock

Booking creation is a check-then-insert operation and is vulnerable to concurrency. Both write paths acquire `pg_advisory_xact_lock(hashtext('room-' || roomId))` inside the transaction. The lock lasts until transaction completion, while the room-based key lets unrelated rooms proceed independently.

A PostgreSQL exclusion constraint would move the overlap rule out of the tested domain layer. `SERIALIZABLE` isolation would instead produce a serialization failure that the API would need to recognize and translate into 409. `bookings.race.test.ts` submits ten simultaneous requests and requires exactly one database row.

### Two Languages

Strings live in `messages/uk.json` and `messages/en.json` and are loaded by next-intl. Locale comes from the `locale` cookie, then `Accept-Language`, with Ukrainian as the fallback. URLs intentionally remain locale-neutral, so saved `/rooms/<id>` links work in either language.

API error messages are localized because they are displayed directly. Luxon formats dates and month names in the selected locale; times remain in the browser timezone.

Social previews use `public/og-uk.jpg` and `public/og-en.jpg`, selected by request locale. `SITE_URL` provides the absolute URL. Only `/login` and `/register` are public to crawlers; authenticated pages use `noindex` and `robots.txt` mirrors that policy.

## Structure

| Directory              | Contents                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `src/app`              | Pages and API routes                                                                        |
| `src/lib/domain`       | Pure overlap, time-rule, and grid-geometry logic, independent of the database and framework |
| `src/lib/server`       | Database, sessions, passwords, and booking service                                          |
| `src/components`       | UI                                                                                          |
| `messages`             | Ukrainian and English UI and API strings                                                    |
| `prisma`               | Schema, migrations, and seed                                                                |
| `tests/api`            | API integration tests                                                                       |
| `e2e`                  | Playwright scenarios and screenshots                                                        |
| `docs/demo.md`         | Project walkthrough                                                                         |
| `docs/api-examples.md` | curl examples for manual API checks                                                         |

## Environment Variables

All variables are documented in `.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_WEEK_START_DAY`, `NEXT_PUBLIC_DEMO_LOGIN`, `SITE_URL`, `NOTIFY_BEFORE_MINUTES`, `REGISTER_LIMIT`, and `TRUST_PROXY`. The real `.env` is excluded from Git.

`NEXT_PUBLIC_WEEK_START_DAY` and `NEXT_PUBLIC_DEMO_LOGIN` are embedded in the client bundle during the build, so Docker passes them as build arguments rather than runtime container variables.

Enable `TRUST_PROXY` only behind a reverse proxy that overwrites `X-Forwarded-For`. With a directly published port, trusting this client-controlled header would defeat failed-login throttling.

**Always set your own `SESSION_SECRET` for a real deployment** with `openssl rand -base64 32`. The `.env.example` value is public and exists only so the demo starts with one command; production mode prints a prominent warning when it is used.

## Security

Passwords use bcrypt with cost 12. Session cookies are `httpOnly`, `sameSite=lax`, `secure` in production, and HMAC-signed. The server checks ownership for every modification, not merely by hiding UI buttons, and integration tests verify both the 403 response and the unchanged database row.

Zod validates request bodies and strips unexpected fields such as `userId`, `id`, `seriesId`, and `canceledAt`. The only raw SQL is the parameterized advisory lock.

Session identifiers contain 256 random bits from the system CSPRNG. Expired sessions and verification tokens are removed on later writes to their respective tables.

Failed login attempts are counted by address and source. Ten invalid-password attempts in five minutes produce `429 TOO_MANY_ATTEMPTS`; successful credentials are not blocked by an attacker's failed attempts against the same address. Unknown addresses are checked against a decoy hash of equal cost to reduce account enumeration through timing.

Registration is separately limited by `REGISTER_LIMIT`, which defaults to 20 attempts per ten minutes. Verification-email resends have their own limit. Verification tokens are stored only as SHA-256 hashes, and links are based on `SITE_URL`, not a caller-controlled `Host` header.

Responses set `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`, while hiding the framework version.

The CSP uses a per-response nonce rather than `unsafe-inline`. One inline script applies the saved theme before first paint, while Next.js adds hydration scripts. The nonce policy lives in `src/middleware.ts`; `unsafe-eval` is enabled only in development.
