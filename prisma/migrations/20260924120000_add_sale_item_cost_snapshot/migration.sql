-- Custo congelado no item vendido (por unidade do item): produto/frações e complementos.
-- cost_source: 'PDV' (o PDV congelou na venda) ou 'BACKEND' (o backend estimou o que faltava).
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "unit_cost" DOUBLE PRECISION;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "complements_cost" DOUBLE PRECISION;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "cost_source" TEXT;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "cost_snapshot" JSONB;
