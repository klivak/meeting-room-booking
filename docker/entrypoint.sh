#!/bin/sh
set -e

# The database is already healthy at this point (compose waits for it), so the
# schema can be applied straight away. migrate deploy, not migrate dev: it only
# applies existing migrations and never prompts or rewrites history.
echo "Applying migrations…"
npx prisma migrate deploy

# The seed is idempotent, so running it on every start is safe and keeps the
# demo bookings anchored to the current week.
echo "Seeding…"
npx prisma db seed

exec "$@"
