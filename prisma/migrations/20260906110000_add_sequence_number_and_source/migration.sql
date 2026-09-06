-- AlterTable cashier_sessions
ALTER TABLE "cashier_sessions" ADD COLUMN IF NOT EXISTS "sequence_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable cashier_entries
ALTER TABLE "cashier_entries" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'WEB';
