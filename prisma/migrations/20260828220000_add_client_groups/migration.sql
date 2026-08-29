-- 1. CreateTable client_groups if not exists
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

-- 2. AlterTable clients for group_id
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "group_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_group_id_fkey'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "clients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "client_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. CreateTable system_configs if not exists
CREATE TABLE IF NOT EXISTS "system_configs" (
    "id" TEXT NOT NULL,
    "merchandise_module" BOOLEAN NOT NULL DEFAULT true,
    "financial_module" BOOLEAN NOT NULL DEFAULT true,
    "treatments_module" BOOLEAN NOT NULL DEFAULT true,
    "cashier_module" BOOLEAN NOT NULL DEFAULT false,
    "cashier_default_origin" TEXT NOT NULL DEFAULT 'Mesa',
    "blind_cashier_closure" BOOLEAN NOT NULL DEFAULT false,
    "hr_module" BOOLEAN NOT NULL DEFAULT true,
    "cestaBasicaValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "financial_management_profile" TEXT NOT NULL DEFAULT 'ANALYTICAL',
    "dashboard_cards" JSONB DEFAULT '{}'::jsonb,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable treatment_transactions if not exists
CREATE TABLE IF NOT EXISTS "treatment_transactions" (
    "id" TEXT NOT NULL,
    "treatment_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "treatment_transactions_treatment_id_transaction_id_key" ON "treatment_transactions"("treatment_id", "transaction_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_transactions_treatment_id_fkey') THEN
        ALTER TABLE "treatment_transactions" ADD CONSTRAINT "treatment_transactions_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_transactions_transaction_id_fkey') THEN
        ALTER TABLE "treatment_transactions" ADD CONSTRAINT "treatment_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. CreateTable client_tabs if not exists
CREATE TABLE IF NOT EXISTS "client_tabs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "cashier_session_id" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_tabs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_tabs_client_id_fkey') THEN
        ALTER TABLE "client_tabs" ADD CONSTRAINT "client_tabs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_tabs_cashier_session_id_fkey') THEN
        ALTER TABLE "client_tabs" ADD CONSTRAINT "client_tabs_cashier_session_id_fkey" FOREIGN KEY ("cashier_session_id") REFERENCES "cashier_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Missing columns on existing tables (Safe for all tenant databases)
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_transit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "sefaz_tPag" TEXT;
ALTER TABLE "pos_machine_rates" ADD COLUMN IF NOT EXISTS "advance_tax_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_machine_rates" ADD COLUMN IF NOT EXISTS "settlement_days" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "client_tabs" ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT false;
