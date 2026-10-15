-- Forma de pagamento "Plataforma" (iFood/99Food) e acerto do motoboy na nuvem (15/10/2026,
-- _claude-sync/relatorios/PLANO-PLATAFORMAS-E-MOTOBOY.md). Idempotente: pode rodar de novo sem erro e não apaga nada.
-- Não cria plataforma nenhuma: cada loja cadastra as suas na web (as taxas são por loja e cada loja tem o seu banco).

-- 1. Cadastro das plataformas (comissão com entrega da loja e da plataforma, taxa do pagamento online, semanas até o repasse)
CREATE TABLE IF NOT EXISTS "delivery_platforms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" TEXT,
    "commission_own_delivery_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_platform_delivery_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "online_payment_fee_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthly_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payout_weeks_after" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_platforms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_platforms_code_key" ON "delivery_platforms"("code");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_platforms_account_id_fkey') THEN
        ALTER TABLE "delivery_platforms" ADD CONSTRAINT "delivery_platforms_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. Tipo da forma de pagamento (nulo = forma comum; 'PLATAFORMA' = paga no app da plataforma)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "kind" TEXT;

-- 3. Identificador ligado à plataforma (o identificador "iFood" da forma "Pago na plataforma" é o iFood)
ALTER TABLE "payment_identifiers" ADD COLUMN IF NOT EXISTS "platform_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_identifiers_platform_id_fkey') THEN
        ALTER TABLE "payment_identifiers" ADD CONSTRAINT "payment_identifiers_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "delivery_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Repasse e comissão da conferência marcados com a plataforma; o que foi liquidado junto leva o mesmo código
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "platform_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "platform_settlement_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_platform_id_fkey') THEN
        ALTER TABLE "transactions" ADD CONSTRAINT "transactions_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "delivery_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "transactions_platform_id_idx" ON "transactions"("platform_id");
CREATE INDEX IF NOT EXISTS "transactions_platform_settlement_id_idx" ON "transactions"("platform_settlement_id");

-- 5. Lançamento do caixa: de qual plataforma é a venda e se a entrega foi da loja (vem do PDV)
ALTER TABLE "cashier_entries" ADD COLUMN IF NOT EXISTS "platform_code" TEXT;
ALTER TABLE "cashier_entries" ADD COLUMN IF NOT EXISTS "platform_own_delivery" BOOLEAN;

-- 6. Motoboys e entregas/diárias a pagar (o PDV é a fonte; o id é o Uuid do PDV)
CREATE TABLE IF NOT EXISTS "delivery_couriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "earning_mode" TEXT NOT NULL DEFAULT 'FIXO',
    "value_per_delivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daily_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "earning_since" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_couriers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "courier_payables" (
    "id" TEXT NOT NULL,
    "courier_uuid" TEXT NOT NULL,
    "courier_id" TEXT,
    "kind" TEXT NOT NULL,
    "order_uuid" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "description" TEXT,
    "fee_charged" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_due" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reason" TEXT,
    "settlement_uuid" TEXT,
    "paid_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_payables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "courier_payables_courier_uuid_idx" ON "courier_payables"("courier_uuid");
CREATE INDEX IF NOT EXISTS "courier_payables_day_idx" ON "courier_payables"("day");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courier_payables_courier_id_fkey') THEN
        ALTER TABLE "courier_payables" ADD CONSTRAINT "courier_payables_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "delivery_couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
