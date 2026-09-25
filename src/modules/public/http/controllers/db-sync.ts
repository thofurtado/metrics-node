import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { getSchemaHash } from './db-status'
import { resumoDoProblema, sincronizarBanco, type ResultadoDoBanco } from '../../services/schema-sync'

async function ensureMasterSchema(pool: Pool) {
  // O botão de sincronização sempre operou apenas nos tenants. Esta tabela, porém,
  // pertence ao banco master usado pelo Admin SaaS e precisa ser criada aqui também.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SaaSIntegrationConfig" (
      "id" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "clientSecret" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SaaSIntegrationConfig_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "SaaSIntegrationConfig_provider_key" UNIQUE ("provider")
    )
  `)
}

export async function syncTenantDb(request: FastifyRequest, reply: FastifyReply) {
  // Check API Key
  const apiKey = request.headers['x-api-key']
  if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
    return reply.status(401).send({ message: 'Acesso não autorizado para sincronização' })
  }

  // forcePush ainda é aceito (Admin antigo manda), mas não muda nada: nenhum caminho apaga tabela ou coluna.
  const syncBodySchema = z.object({
    dbName: z.string().min(1),
    forcePush: z.boolean().optional().default(false)
  })

  const { dbName } = syncBodySchema.parse(request.body)

  // Validate dbName to avoid SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    return reply.status(400).send({ message: 'Nome de banco de dados inválido.' })
  }

  try {
    console.log(`🚀 Iniciando sincronização para o banco: ${dbName}`)

    // 1. Construct database URL
    const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"
    const dbUrl = `${baseUrl}/${dbName}?schema=public`

    const resultado = await sincronizarBanco(dbName, dbUrl)
    console.log(`Resultado da sincronização do banco ${dbName}:`, JSON.stringify(resultado))

    // 3. Update Tenant schemaVersion in db_master
    const currentHash = getSchemaHash()
    const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
    const pool = new Pool({ connectionString: masterUrl })
    await ensureMasterSchema(pool)
    // Só marca "em dia" quando deu tudo certo; com problema, o Admin continua mostrando o banco como pendente.
    if (resultado.ok) {
      await pool.query('UPDATE "Tenant" SET "schemaVersion" = $1, "dbSyncedAt" = NOW() WHERE "dbName" = $2', [currentHash, dbName])
    }
    await pool.end()

    if (!resultado.ok) {
      const problema = resumoDoProblema(resultado)
      console.error(`❌ Sincronização do banco ${dbName} com problemas: ${problema}`)
      return reply.status(500).send({ success: false, message: `Sincronização com problemas (nada foi apagado). ${problema}`, resultado })
    }

    console.log(`✅ Sincronização do banco ${dbName} concluída sem apagar nada.`)
    return reply.status(200).send({ success: true, message: 'Banco sincronizado. Nada foi apagado.', resultado })
  } catch (error: any) {
    console.error('❌ Erro na sincronização:', error)
    return reply.status(500).send({ message: 'Erro ao sincronizar banco de dados: ' + (error.stderr || error.message), details: error.message })
  }
}

export async function syncAllTenantsDb(request: FastifyRequest, reply: FastifyReply) {
  // Check API Key
  const apiKey = request.headers['x-api-key']
  if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
    return reply.status(401).send({ message: 'Acesso não autorizado para sincronização' })
  }

  // forcePush ainda é aceito (Admin antigo manda), mas não muda nada: nenhum caminho apaga tabela ou coluna.
  const syncBodySchema = z.object({
    forcePush: z.boolean().optional().default(false)
  }).optional()

  syncBodySchema?.parse(request.body || {})

  const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: masterUrl })
    await ensureMasterSchema(pool)
    const result = await pool.query('SELECT "dbName", domain FROM "Tenant" WHERE status = $1 ORDER BY name ASC', ['active'])
    const tenants = result.rows

    if (tenants.length === 0) {
      await pool.end()
      return reply.status(200).send({ success: true, message: 'Nenhum tenant ativo encontrado.', total: 0, successes: 0, failures: [] })
    }

    console.log(`🚀 Iniciando sincronização em massa para ${tenants.length} tenants ativos...`)

    let successes = 0
    const failures: any[] = []
    const resultados: (ResultadoDoBanco & { domain: string })[] = []
    const currentHash = getSchemaHash()

    for (const tenant of tenants) {
      const { dbName, domain } = tenant
      const dbUrl = `${baseUrl}/${dbName}?schema=public`

      console.log(`-------------------------------------------------`)
      console.log(`🔄 Sincronizando banco: ${dbName} (Domínio: ${domain})`)

      try {
        const resultado = await sincronizarBanco(dbName, dbUrl)
        resultados.push({ ...resultado, domain })

        if (!resultado.ok) {
          const problema = resumoDoProblema(resultado)
          console.error(`❌ Falha no banco ${dbName}:`, problema)
          failures.push({ dbName, domain, error: problema })
          continue
        }

        successes++
        await pool.query('UPDATE "Tenant" SET "schemaVersion" = $1, "dbSyncedAt" = NOW() WHERE "dbName" = $2', [currentHash, dbName])
        console.log(`✅ Sucesso no banco ${dbName}!`)
      } catch (err: any) {
        const errMsg = err.stderr ? err.stderr.toString() : err.message
        console.error(`❌ Falha no banco ${dbName}:`, errMsg)
        failures.push({ dbName, domain, error: errMsg })
      }
    }

    await pool.end()
    pool = null

    return reply.status(200).send({
      success: true,
      total: tenants.length,
      successes,
      failures,
      resultados,
      message: `Sincronização concluída: ${successes}/${tenants.length} bancos atualizados com sucesso. Nada foi apagado.`
    })
  } catch (error: any) {
    if (pool) {
      try { await pool.end() } catch (_) {}
    }
    console.error('❌ Erro na sincronização em massa:', error)
    return reply.status(500).send({ message: 'Erro ao executar sincronização em massa: ' + error.message })
  }
}
