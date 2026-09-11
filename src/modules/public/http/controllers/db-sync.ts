import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { execSync } from 'child_process'
import { getSchemaHash } from './db-status'

export async function syncTenantDb(request: FastifyRequest, reply: FastifyReply) {
  // Check API Key
  const apiKey = request.headers['x-api-key']
  if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
    return reply.status(401).send({ message: 'Acesso não autorizado para sincronização' })
  }

  const syncBodySchema = z.object({
    dbName: z.string().min(1),
    forcePush: z.boolean().optional().default(false)
  })

  const { dbName, forcePush } = syncBodySchema.parse(request.body)

  // Validate dbName to avoid SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    return reply.status(400).send({ message: 'Nome de banco de dados inválido.' })
  }

  try {
    console.log(`🚀 Iniciando sincronização para o banco: ${dbName} (forcePush: ${forcePush})`)

    // 1. Construct database URL
    const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"
    const dbUrl = `${baseUrl}/${dbName}?schema=public`

    let result = ''

    // Limpa registros de migrações incompletas/falhas anteriores para não bloquear o prisma migrate deploy (P3009)
    try {
      const cleanupPool = new Pool({ connectionString: dbUrl })
      await cleanupPool.query('DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL')
      await cleanupPool.end()
    } catch (_) {}

    if (forcePush) {
      console.log(`⚙️ Executando db push direto no banco ${dbName}...`)
      result = execSync(`npx prisma db push --accept-data-loss`, { 
        env: { ...process.env, DATABASE_URL: dbUrl },
        encoding: 'utf-8'
      })
    } else {
      try {
        console.log(`📦 Tentando prisma migrate deploy no banco ${dbName}...`)
        result = execSync(`npx prisma migrate deploy`, { 
          env: { ...process.env, DATABASE_URL: dbUrl },
          encoding: 'utf-8'
        })
      } catch (deployError: any) {
        console.warn(`⚠️ prisma migrate deploy falhou no banco ${dbName}, executando db push como fallback:`, deployError.message)
        result = execSync(`npx prisma db push --accept-data-loss`, { 
          env: { ...process.env, DATABASE_URL: dbUrl },
          encoding: 'utf-8'
        })
      }
    }

    console.log(result)

    // 3. Update Tenant schemaVersion in db_master
    const currentHash = getSchemaHash()
    const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
    const pool = new Pool({ connectionString: masterUrl })
    await pool.query('UPDATE "Tenant" SET "schemaVersion" = $1, "dbSyncedAt" = NOW() WHERE "dbName" = $2', [currentHash, dbName])
    await pool.end()

    console.log(`✅ Sincronização do banco ${dbName} concluída com sucesso!`)
    return reply.status(200).send({ success: true, message: 'Banco de dados sincronizado com sucesso!', log: result })
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

  const syncBodySchema = z.object({
    forcePush: z.boolean().optional().default(false)
  }).optional()

  const { forcePush = false } = syncBodySchema?.parse(request.body || {}) || {}

  const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: masterUrl })
    const result = await pool.query('SELECT "dbName", domain FROM "Tenant" WHERE status = $1 ORDER BY name ASC', ['active'])
    const tenants = result.rows

    if (tenants.length === 0) {
      await pool.end()
      return reply.status(200).send({ success: true, message: 'Nenhum tenant ativo encontrado.', total: 0, successes: 0, failures: [] })
    }

    console.log(`🚀 Iniciando sincronização em massa para ${tenants.length} tenants ativos (forcePush: ${forcePush})...`)

    let successes = 0
    const failures: any[] = []
    const currentHash = getSchemaHash()

    for (const tenant of tenants) {
      const { dbName, domain } = tenant
      const dbUrl = `${baseUrl}/${dbName}?schema=public`

      console.log(`-------------------------------------------------`)
      console.log(`🔄 Sincronizando banco: ${dbName} (Domínio: ${domain})`)

      try {
        // Limpa registros de migrações incompletas/falhas anteriores
        try {
          const cleanupPool = new Pool({ connectionString: dbUrl })
          await cleanupPool.query('DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL')
          await cleanupPool.end()
        } catch (_) {}

        let log = ''
        if (forcePush) {
          log = execSync(`npx prisma db push --accept-data-loss`, {
            env: { ...process.env, DATABASE_URL: dbUrl },
            encoding: 'utf-8'
          })
        } else {
          try {
            log = execSync(`npx prisma migrate deploy`, {
              env: { ...process.env, DATABASE_URL: dbUrl },
              encoding: 'utf-8'
            })
          } catch (deployError: any) {
            console.warn(`⚠️ migrate deploy falhou no banco ${dbName}, executando db push como fallback:`, deployError.message)
            log = execSync(`npx prisma db push --accept-data-loss`, {
              env: { ...process.env, DATABASE_URL: dbUrl },
              encoding: 'utf-8'
            })
          }
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
      message: `Sincronização concluída: ${successes}/${tenants.length} bancos atualizados com sucesso.`
    })
  } catch (error: any) {
    if (pool) {
      try { await pool.end() } catch (_) {}
    }
    console.error('❌ Erro na sincronização em massa:', error)
    return reply.status(500).send({ message: 'Erro ao executar sincronização em massa: ' + error.message })
  }
}
