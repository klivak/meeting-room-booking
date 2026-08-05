-- DropIndex
DROP INDEX "Booking_userId_startsAt_idx";

-- CreateIndex
CREATE INDEX "Booking_userId_canceledAt_endsAt_startsAt_idx" ON "Booking"("userId", "canceledAt", "endsAt", "startsAt");
