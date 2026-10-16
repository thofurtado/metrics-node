-- Valores dos pedidos do iFood e da 99Food (decisão do Thomás, 15/10/2026). Idempotente: pode rodar de novo sem erro e não
-- apaga nada. Uma linha por pedido da plataforma, ligada ao pedido da loja: itens, frete, taxa de serviço, desconto de quem
-- (loja, plataforma, outros), o que o cliente pagou, se foi pago no app, quem entregou, o que a plataforma deve à loja antes
-- da comissão (expected_gross) e o trecho original dos valores (raw). As colunas *_real ficam vazias até virem do extrato.
-- Não preenche nada: os pedidos novos ganham a linha ao chegar; os antigos da Katatau, pelo roteiro
-- _claude-sync/consultas/katatau_valores_ifood.py (só com o sim do Thomás).

CREATE TABLE IF NOT EXISTS "pedido_valores_plataforma" (
    "id" TEXT NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "items_value" DOUBLE PRECISION,
    "delivery_fee" DOUBLE PRECISION,
    "service_fee" DOUBLE PRECISION,
    "discount_total" DOUBLE PRECISION,
    "discount_store" DOUBLE PRECISION,
    "discount_platform" DOUBLE PRECISION,
    "discount_other" DOUBLE PRECISION,
    "customer_paid" DOUBLE PRECISION,
    "paid_online" BOOLEAN NOT NULL DEFAULT false,
    "own_delivery" BOOLEAN,
    "expected_gross" DOUBLE PRECISION,
    "raw" JSONB,
    "commission_real" DOUBLE PRECISION,
    "fee_real" DOUBLE PRECISION,
    "payout_real" DOUBLE PRECISION,
    "payout_date_real" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_valores_plataforma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pedido_valores_plataforma_pedido_id_key" ON "pedido_valores_plataforma"("pedido_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pedido_valores_plataforma_platform_external_id_key" ON "pedido_valores_plataforma"("platform", "external_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_valores_plataforma_pedido_id_fkey') THEN
        ALTER TABLE "pedido_valores_plataforma" ADD CONSTRAINT "pedido_valores_plataforma_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
