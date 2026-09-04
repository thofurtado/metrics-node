-- Drop old constraints if they exist
ALTER TABLE "transfer_transactions" DROP CONSTRAINT IF EXISTS "transfer_transactions_destination_account_id_fkey";
ALTER TABLE "transfer_transactions" DROP CONSTRAINT IF EXISTS "transfer_transactions_transaction_id_fkey";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_transactions' AND column_name = 'destination_account_id') THEN
        ALTER TABLE "transfer_transactions" DROP COLUMN "destination_account_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_transactions' AND column_name = 'transaction_id') THEN
        ALTER TABLE "transfer_transactions" DROP COLUMN "transaction_id";
    END IF;
END $$;

ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "source_transaction_id" TEXT NOT NULL;
ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "dest_transaction_id" TEXT NOT NULL;
ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "is_automated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "transfer_transactions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "transfer_transactions_source_transaction_id_key" ON "transfer_transactions"("source_transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_transactions_dest_transaction_id_key" ON "transfer_transactions"("dest_transaction_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfer_transactions_source_transaction_id_fkey') THEN
        ALTER TABLE "transfer_transactions" ADD CONSTRAINT "transfer_transactions_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfer_transactions_dest_transaction_id_fkey') THEN
        ALTER TABLE "transfer_transactions" ADD CONSTRAINT "transfer_transactions_dest_transaction_id_fkey" FOREIGN KEY ("dest_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- High-performance indexes on transactions
CREATE INDEX IF NOT EXISTS "transactions_data_vencimento_idx" ON "transactions"("data_vencimento");
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions"("account_id");
CREATE INDEX IF NOT EXISTS "transactions_sector_id_idx" ON "transactions"("sector_id");
CREATE INDEX IF NOT EXISTS "transactions_supplier_id_idx" ON "transactions"("supplier_id");
CREATE INDEX IF NOT EXISTS "transactions_cashier_session_id_idx" ON "transactions"("cashier_session_id");
