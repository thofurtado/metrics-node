-- Observação rápida (só no salão) nos grupos de complementos (decisão do Thomás, 16/10/2026, PLANO-GARCOM-CLASSE-A.md seção 4).
-- Idempotente: pode rodar de novo sem erro e não apaga nada. Todo grupo que já existe continua como antes (false): segue no
-- cardápio online e no PDV do mesmo jeito. Grupo marcado tem as opções com preço zero, nunca sai no cardápio online nem no
-- cardápio enviado ao iFood/99 e, no PDV e no app do garçom, vira botões de observação com contador.

ALTER TABLE "complement_groups" ADD COLUMN IF NOT EXISTS "quick_note" BOOLEAN NOT NULL DEFAULT false;
