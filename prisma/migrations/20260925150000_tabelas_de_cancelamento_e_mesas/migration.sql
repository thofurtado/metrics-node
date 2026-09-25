-- Tabelas que existiam no schema.prisma e no código, mas nunca tiveram migration (25/09/2026).
-- Sem elas: o registro de cancelamentos era descartado em silêncio (aba "Cancelamentos" da Conferência sempre vazia)
-- e a foto das mesas abertas não era gravada. Só cria o que falta; idempotente (pode rodar de novo, e não briga com
-- banco onde um "db push" já tenha criado as tabelas).

CREATE TABLE IF NOT EXISTS "cancellation_audits" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT,
    "order_id" TEXT,
    "item_id" TEXT,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL,
    "origin_identifier" TEXT,
    "origin_uuid" TEXT,
    "cancellation_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "stock_restored" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cancellation_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "active_tables" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MESA',
    "status" TEXT NOT NULL DEFAULT 'Ocupada',
    "people_count" INTEGER NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "waiter_id" TEXT,
    "waiter_name" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "active_tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "active_tables_identifier_key" ON "active_tables"("identifier");

CREATE TABLE IF NOT EXISTS "active_table_items" (
    "id" TEXT NOT NULL,
    "active_table_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "complements_json" TEXT,
    "observation" TEXT,
    "waiter_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "active_table_items_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'active_table_items_active_table_id_fkey') THEN
    ALTER TABLE "active_table_items" ADD CONSTRAINT "active_table_items_active_table_id_fkey"
      FOREIGN KEY ("active_table_id") REFERENCES "active_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
