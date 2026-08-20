-- AlterTable: products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subcategory_id" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_priority" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: subcategories
CREATE TABLE IF NOT EXISTS "subcategories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "accepts_fractions" BOOLEAN NOT NULL DEFAULT false,
    "max_fractions" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: complement_groups
CREATE TABLE IF NOT EXISTS "complement_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER NOT NULL DEFAULT 1,
    "free_quantity" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complement_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: complement_options
CREATE TABLE IF NOT EXISTS "complement_options" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linked_product_id" TEXT,
    "linked_supply_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complement_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_complement_groups
CREATE TABLE IF NOT EXISTS "product_complement_groups" (
    "product_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_complement_groups_pkey" PRIMARY KEY ("product_id","group_id")
);

-- AddForeignKey (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcategories_category_id_fkey') THEN
        ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_subcategory_id_fkey') THEN
        ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complement_options_group_id_fkey') THEN
        ALTER TABLE "complement_options" ADD CONSTRAINT "complement_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "complement_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_complement_groups_product_id_fkey') THEN
        ALTER TABLE "product_complement_groups" ADD CONSTRAINT "product_complement_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_complement_groups_group_id_fkey') THEN
        ALTER TABLE "product_complement_groups" ADD CONSTRAINT "product_complement_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "complement_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
