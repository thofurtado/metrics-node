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
