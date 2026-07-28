-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "BookingSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
