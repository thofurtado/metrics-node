-- DropForeignKey
ALTER TABLE "compositions" DROP CONSTRAINT "compositions_product_id_fkey";

-- AlterTable
ALTER TABLE "compositions" ADD COLUMN     "service_id" TEXT,
ALTER COLUMN "product_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "merchandise_module" BOOLEAN NOT NULL DEFAULT true,
    "financial_module" BOOLEAN NOT NULL DEFAULT true,
    "treatments_module" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
