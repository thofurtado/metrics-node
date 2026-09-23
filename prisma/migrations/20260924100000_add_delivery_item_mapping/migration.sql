-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "plataforma" TEXT;

-- AlterTable
ALTER TABLE "pedido_itens" ADD COLUMN IF NOT EXISTS "external_code" TEXT;
ALTER TABLE "pedido_itens" ADD COLUMN IF NOT EXISTS "external_name" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_item_mappings" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_code" TEXT NOT NULL,
    "external_name" TEXT,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_item_mappings_platform_external_code_key" ON "delivery_item_mappings"("platform", "external_code");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "delivery_item_mappings" ADD CONSTRAINT "delivery_item_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
