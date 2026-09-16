-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "stock_control_module" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "gemini_api_key" TEXT;
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "gemini_model" TEXT NOT NULL DEFAULT 'gemini-1.5-flash';
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "auto_nfe_mapping" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "batch_number" TEXT;
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMP(3);
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "supplier_cnpj" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_product_mappings" (
    "id" TEXT NOT NULL,
    "supplier_cnpj" TEXT NOT NULL,
    "supplier_name" TEXT,
    "supplier_product_code" TEXT NOT NULL,
    "supplier_product_name" TEXT NOT NULL,
    "supplier_unit" TEXT NOT NULL,
    "supply_id" TEXT,
    "product_id" TEXT,
    "conversion_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sector" TEXT DEFAULT 'GERAL',
    "blind_count" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" TEXT NOT NULL,
    "inventory_session_id" TEXT NOT NULL,
    "supply_id" TEXT,
    "product_id" TEXT,
    "system_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "counted_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_difference_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_product_mappings_supplier_cnpj_supplier_product_code_key" ON "supplier_product_mappings"("supplier_cnpj", "supplier_product_code");

-- AddForeignKey
ALTER TABLE "supplier_product_mappings" DROP CONSTRAINT IF EXISTS "supplier_product_mappings_supply_id_fkey";
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_mappings" DROP CONSTRAINT IF EXISTS "supplier_product_mappings_product_id_fkey";
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "inventory_items_inventory_session_id_fkey";
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_inventory_session_id_fkey" FOREIGN KEY ("inventory_session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "inventory_items_supply_id_fkey";
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "inventory_items_product_id_fkey";
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
