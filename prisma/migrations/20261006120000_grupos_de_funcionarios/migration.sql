-- Grupos de funcionários (etapa 1.5, 06/10/2026): o cargo (texto livre) vira cadastro, e cada grupo diz se quem está nele
-- pode usar o app do garçom e/ou o PDV (login pelo PIN do ponto). Idempotente: pode rodar de novo sem erro e não apaga nada.

-- 1. Tabela dos grupos
CREATE TABLE IF NOT EXISTS "employee_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "can_use_waiter_app" BOOLEAN NOT NULL DEFAULT false,
    "can_use_pdv" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_groups_name_key" ON "employee_groups"("name");

-- 2. Funcionário ligado ao grupo (apagar o grupo só desliga, nunca apaga o funcionário)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "group_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_group_id_fkey') THEN
        ALTER TABLE "employees" ADD CONSTRAINT "employees_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "employee_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Os grupos nascem dos cargos que já existem (um por nome, sem diferenciar maiúsculas). Acesso inicial pelo nome do cargo,
--    como o Thomás exemplificou: garçom, maître, atendente e cumim usam o app do garçom; caixa e operador usam o PDV. O resto
--    nasce sem acesso; o gerente ajusta em RH > Configurações > Grupos.
INSERT INTO "employee_groups" ("id", "name", "can_use_waiter_app", "can_use_pdv", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text || c.chave)::uuid::text,
       c.nome,
       c.chave ~ '(gar[cç]om|gar[cç]onete|ma[iî]tre|atendente|cumim|commis)',
       c.chave ~ '(caixa|operador)',
       CURRENT_TIMESTAMP
FROM (
    -- Um grupo por nome sem diferenciar maiúsculas; a grafia escolhida é a com inicial maiúscula e, entre elas, a mais usada
    SELECT lower(n.nome) AS chave,
           (array_agg(n.nome ORDER BY (n.nome ~ '^[[:upper:]]') DESC, n.qtd DESC, n.nome))[1] AS nome
    FROM (
        SELECT regexp_replace(trim("role"), '\s+', ' ', 'g') AS nome, count(*) AS qtd
        FROM "employees"
        WHERE trim(coalesce("role", '')) <> ''
        GROUP BY regexp_replace(trim("role"), '\s+', ' ', 'g')
    ) n
    GROUP BY lower(n.nome)
) c
WHERE NOT EXISTS (SELECT 1 FROM "employee_groups" g WHERE lower(g."name") = c.chave);

UPDATE "employees" e
SET "group_id" = g."id"
FROM "employee_groups" g
WHERE e."group_id" IS NULL
  AND lower(regexp_replace(trim(e."role"), '\s+', ' ', 'g')) = lower(g."name");
