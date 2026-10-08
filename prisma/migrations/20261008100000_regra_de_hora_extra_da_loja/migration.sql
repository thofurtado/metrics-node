-- Regra de hora extra da loja (08/10/2026, ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md). Idempotente: pode rodar de novo sem erro e
-- não apaga nada. Os valores padrão das colunas reproduzem a conta antiga, para nenhuma linha que já exista mudar de sentido.

ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "model_key" TEXT NOT NULL DEFAULT 'PERSONALIZADO';
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "weekly_workload_minutes" INTEGER NOT NULL DEFAULT 2640;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "count_weekly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "second_tier_after_minutes" INTEGER;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "he_multiplier_second_tier" DECIMAL(65,30);
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "sunday_mode" TEXT NOT NULL DEFAULT 'EXCEDENTE_100';
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "holiday_mode" TEXT NOT NULL DEFAULT 'DIA_TODO_100';
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "night_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "night_additional" DECIMAL(65,30) NOT NULL DEFAULT 0.2;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "night_reduced_hour" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "daily_rate_minutes" INTEGER NOT NULL DEFAULT 480;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "daily_workers_overtime" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "hr_rule_histories" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- A loja que já usa o ponto e nunca gravou regra ganha a "regra antiga" como a primeira: é a conta que o espelho da web fazia até
-- a versão 2.6.22 (7h20 por dia, tolerância de 10 min, 60%, domingo com o excedente a 100%, feriado o dia todo a 100%, sem
-- noturno, diarista sem valor de hora extra). Assim nada muda de surpresa no dia da troca (D18 e D19): a loja passa para a regra
-- dela quando confirmar na tela RH > Configurações. Loja sem nenhuma batida não ganha nada: fica no padrão da CLT (D2).
INSERT INTO "hr_rule_histories" (
    "id", "valid_from", "he_divisor", "he_multiplier_standard", "he_multiplier_special", "daily_workload_minutes",
    "tolerance_minutes", "model_key", "weekly_workload_minutes", "count_weekly", "sunday_mode", "holiday_mode",
    "night_enabled", "night_additional", "night_reduced_hour", "daily_rate_minutes", "daily_workers_overtime", "notes",
    "created_at", "updated_at"
)
SELECT md5(random()::text || clock_timestamp()::text)::uuid::text, TIMESTAMP '2000-01-01 00:00:00', 220, 1.6, 2.0, 440,
       10, 'LEGADO', 2640, false, 'EXCEDENTE_100', 'DIA_TODO_100',
       false, 0.2, true, 440, false, 'Conta que o espelho de ponto fazia até a versão 2.6.22 da web (gravada na migração de 08/10/2026).',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "hr_rule_histories")
  AND EXISTS (SELECT 1 FROM "time_clocks");
