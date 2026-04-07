-- AlterTable
ALTER TABLE "time_clocks" ADD COLUMN "absenceReason" TEXT;
ALTER TABLE "time_clocks" ADD COLUMN "isJustifiedAbsence" BOOLEAN NOT NULL DEFAULT false;
