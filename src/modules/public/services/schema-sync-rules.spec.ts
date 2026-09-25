import { describe, expect, it } from 'vitest'
import { limparMensagem, separarDiff } from './schema-sync-rules'

// Saída real do "prisma migrate diff --script" (Prisma 6.19) entre dois schemas de teste.
const DIFF_MISTO = `-- AlterEnum
BEGIN;
CREATE TYPE "Cor_new" AS ENUM ('AZUL', 'VERDE', 'AMARELO');
ALTER TABLE "t" ALTER COLUMN "cor" TYPE "Cor_new" USING ("cor"::text::"Cor_new");
ALTER TYPE "Cor" RENAME TO "Cor_old";
ALTER TYPE "Cor_new" RENAME TO "Cor";
DROP TYPE "Cor_old";
COMMIT;

-- AlterEnum
ALTER TYPE "Situacao" ADD VALUE 'C';

-- DropIndex
DROP INDEX "t_a_idx";

-- AlterTable
ALTER TABLE "t" DROP COLUMN "c",
ADD COLUMN     "e" INTEGER,
ALTER COLUMN "a" DROP NOT NULL,
ALTER COLUMN "b" SET DATA TYPE TEXT,
ALTER COLUMN "d" SET DEFAULT 0,
ALTER COLUMN "f" DROP DEFAULT;

-- DropTable
DROP TABLE "Velha";

-- CreateTable
CREATE TABLE "Nova" (
    "id" TEXT NOT NULL,
    "t_id" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "Nova_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nova_t_id_key" ON "Nova"("t_id");

-- CreateIndex
CREATE INDEX "t_a_e_idx" ON "t"("a", "e");

-- AddForeignKey
ALTER TABLE "Nova" ADD CONSTRAINT "Nova_t_id_fkey" FOREIGN KEY ("t_id") REFERENCES "t"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
`

describe('separarDiff: o Sincronizar nunca apaga nada', () => {
  const { aplicar, mantidos } = separarDiff(DIFF_MISTO)
  const sqls = aplicar.map(p => p.sql).join('\n')

  it('nenhum comando aplicado apaga ou muda o tipo de algo', () => {
    expect(sqls).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|TYPE|DEFAULT)\b/i)
    expect(sqls).not.toMatch(/\bTYPE\s+"Cor_new"|SET DATA TYPE|RENAME TO "Cor_old"/i)
  })

  it('aplica só o que acrescenta, uma cláusula por vez', () => {
    expect(aplicar.map(p => p.descricao)).toEqual([
      'valor C do tipo Situacao',
      'coluna t.e',
      't.a passa a aceitar vazio',
      'valor padrão de t.d',
      'tabela Nova',
      'índice Nova_t_id_key',
      'índice t_a_e_idx',
      'ligação Nova_t_id_fkey',
    ])
    expect(aplicar[1].sql).toBe('ALTER TABLE "t" ADD COLUMN     "e" INTEGER')
    expect(aplicar[4].sql).toContain('"valor" DECIMAL(65,30) NOT NULL DEFAULT 0')
  })

  it('lista o que foi mantido, em palavras', () => {
    expect(mantidos).toEqual([
      'tipo Cor com valores diferentes do sistema (não alterado)',
      'índice t_a_idx (não existe no sistema)',
      'coluna t.c (não existe no sistema)',
      'coluna t.b com tipo diferente do sistema (não alterada)',
      'valor padrão de t.f (o sistema não usa)',
      'tabela Velha (não existe no sistema)',
    ])
  })

  it('o caso de 25/09/2026: tabela que só existia no banco do cliente fica', () => {
    const r = separarDiff('-- DropTable\nDROP TABLE "public"."SaaSIntegrationConfig";\n')
    expect(r.aplicar).toEqual([])
    expect(r.mantidos).toEqual(['tabela SaaSIntegrationConfig (não existe no sistema)'])
  })

  it('ligação removida do schema também fica', () => {
    const r = separarDiff('-- DropForeignKey\nALTER TABLE "public"."clients" DROP CONSTRAINT "clients_group_id_fkey";\n')
    expect(r.aplicar).toEqual([])
    expect(r.mantidos).toEqual(['restrição ou ligação clients_group_id_fkey da tabela clients (não existe no sistema)'])
  })

  it('banco igual ao sistema: nada a fazer', () => {
    expect(separarDiff('-- This is an empty migration.\n')).toEqual({ aplicar: [], mantidos: [] })
    expect(separarDiff('')).toEqual({ aplicar: [], mantidos: [] })
  })

  it('comando desconhecido nunca é aplicado', () => {
    const r = separarDiff('TRUNCATE "sales";\nALTER TABLE "t" RENAME COLUMN "a" TO "b";\n')
    expect(r.aplicar).toEqual([])
    expect(r.mantidos).toHaveLength(2)
    expect(r.mantidos[0]).toMatch(/^comando não reconhecido/)
  })

  it('bloco BEGIN/COMMIT só com acréscimos é aplicado inteiro', () => {
    const r = separarDiff('BEGIN;\nCREATE TYPE "X" AS ENUM (\'A\');\nALTER TABLE "t" ADD COLUMN "x" "X";\nCOMMIT;\n')
    expect(r.mantidos).toEqual([])
    expect(r.aplicar).toHaveLength(1)
    expect(r.aplicar[0].sql).toBe('BEGIN;\nCREATE TYPE "X" AS ENUM (\'A\');\nALTER TABLE "t" ADD COLUMN "x" "X";\nCOMMIT;')
  })
})

describe('limparMensagem', () => {
  it('nunca mostra o endereço do banco e tira o ruído do Prisma', () => {
    const texto = [
      'warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.',
      'For more information, see: https://pris.ly/prisma-config',
      'Datasource "db": PostgreSQL database "db_x", schema "public" at "10.0.0.1:5432"',
      'Error: P3018 falhou em postgresql://usuario:senha@10.0.0.1:5432/db_x',
    ].join('\n')
    expect(limparMensagem(texto)).toBe('Error: P3018 falhou em <banco>')
  })
})
