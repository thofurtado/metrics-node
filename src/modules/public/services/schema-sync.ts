import { exec } from 'child_process'
import { promisify } from 'util'
import { Pool } from 'pg'
import { limparMensagem, separarDiff } from './schema-sync-rules'

// Sincroniza o banco de um cliente com o schema deste backend SEM APAGAR NADA (25/09/2026).
// Antes, se as migrations falhassem (ou com "forçar"), rodava "prisma db push --accept-data-loss",
// que apaga toda tabela e coluna que não está no schema, com os dados dentro.
// Agora: 1) migrations (o caminho oficial); 2) cria o que ainda faltar; 3) lista o que sobra, sem tocar.

const executar = promisify(exec)

export type ResultadoDoBanco = {
  dbName: string
  ok: boolean
  migracoes: 'ok' | 'falhou'
  erroMigracao?: string
  criados: string[]
  naoCriados: string[]
  mantidos: string[]
}

// Assíncrono de propósito: o execSync antigo travava a API inteira (todas as lojas) durante a sincronização.
async function prisma(comando: string, dbUrl: string) {
  const { stdout } = await executar(`npx prisma ${comando}`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
  })
  return stdout
}

const erroDoPrisma = (err: any) => limparMensagem(err?.stderr || err?.message || err)

export async function sincronizarBanco(dbName: string, dbUrl: string): Promise<ResultadoDoBanco> {
  const r: ResultadoDoBanco = { dbName, ok: false, migracoes: 'ok', criados: [], naoCriados: [], mantidos: [] }
  const pool = new Pool({ connectionString: dbUrl })
  try {
    // Migration que falhou numa rodada anterior fica registrada sem fim e bloqueia o migrate deploy (P3009).
    // Apagar esse registro só libera a nova tentativa; as migrations são idempotentes.
    try {
      await pool.query('DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL')
    } catch (_) {}

    try {
      await prisma('migrate deploy', dbUrl)
    } catch (err) {
      r.migracoes = 'falhou'
      r.erroMigracao = erroDoPrisma(err)
    }

    try {
      const script = await prisma('migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script', dbUrl)
      const { aplicar, mantidos } = separarDiff(script)
      r.mantidos = mantidos
      for (const passo of aplicar) {
        try {
          await pool.query(passo.sql)
          r.criados.push(passo.descricao)
        } catch (err: any) {
          r.naoCriados.push(`${passo.descricao}: ${limparMensagem(err?.message)}`)
        }
      }
    } catch (err) {
      r.naoCriados.push(`não foi possível comparar o banco com o sistema: ${erroDoPrisma(err)}`)
    }
  } finally {
    await pool.end().catch(() => {})
  }
  r.ok = r.migracoes === 'ok' && r.naoCriados.length === 0
  return r
}

// Uma linha para o Admin quando algo não deu certo.
export function resumoDoProblema(r: ResultadoDoBanco): string {
  const partes: string[] = []
  if (r.migracoes === 'falhou') {
    partes.push(`As migrations falharam${r.criados.length ? ' (o que faltava na estrutura foi criado mesmo assim)' : ''}: ${r.erroMigracao}`)
  }
  if (r.naoCriados.length) partes.push(`Não foi possível criar: ${r.naoCriados.join('; ')}`)
  return partes.join(' | ')
}
