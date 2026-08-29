-- CreateTable client_groups
CREATE TABLE IF NOT EXISTS "client_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headscale_user" TEXT,
    "vpn_preauth_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable clients
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "group_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_group_id_fkey'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "clients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "client_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Missing columns sync (Safe for all tenant databases)
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_transit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "sefaz_tPag" TEXT;
ALTER TABLE "pos_machine_rates" ADD COLUMN IF NOT EXISTS "advance_tax_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_machine_rates" ADD COLUMN IF NOT EXISTS "settlement_days" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "client_tabs" ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT false;
