-- Quantidade do insumo consumida por escolha do complemento. Estava no schema.prisma mas nunca teve migration:
-- bancos sem a coluna quebravam a sincronização de vendas (item-cost-loader lê complement_options.supply_quantity).
ALTER TABLE "complement_options" ADD COLUMN IF NOT EXISTS "supply_quantity" DOUBLE PRECISION DEFAULT 1.0;
