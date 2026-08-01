import { FastifyReply, FastifyRequest } from 'fastify'
import { Pool } from 'pg'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export function getSchemaHash(): string {
  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf8')
    return crypto.createHash('md5').update(content).digest('hex')
  } catch (err) {
    console.error('Erro ao calcular hash do schema:', err)
    return 'unknown'
  }
}

export async function getDbStatus(request: FastifyRequest, reply: FastifyReply) {
  // Check API Key
  const apiKey = request.headers['x-api-key']
  if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
    return reply.status(401).send({ message: 'Acesso não autorizado' })
  }

  const currentHash = getSchemaHash()
  const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
  
  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: masterUrl })
    const result = await pool.query('SELECT "id", "name", "dbName", "schemaVersion", "dbSyncedAt" FROM "Tenant" WHERE status = $1 ORDER BY name ASC', ['active'])
    await pool.end()
    pool = null

    const databases = []
    const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"

    for (const row of result.rows) {
      const dbName = row.dbName
      const schemaVersion = row.schemaVersion
      const dbSyncedAt = row.dbSyncedAt
      const tenantId = row.id
      const tenantName = row.name

      let tableCount = 0
      let status = 'error'
      let errorMsg = null

      let tenantPool: Pool | null = null
      try {
        const tenantUrl = `${baseUrl}/${dbName}?schema=public`
        tenantPool = new Pool({ connectionString: tenantUrl, connectionTimeoutMillis: 3000 })
        const tableResult = await tenantPool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
        tableCount = parseInt(tableResult.rows[0].count, 10)
        status = 'connected'
        await tenantPool.end()
        tenantPool = null
      } catch (e: any) {
        if (tenantPool) {
          try { await tenantPool.end() } catch (_) {}
        }
        errorMsg = e.message
      }

      databases.push({
        id: tenantId,
        name: tenantName,
        dbName,
        schemaVersion,
        dbSyncedAt,
        tableCount,
        status,
        error: errorMsg,
        isUpdated: schemaVersion === currentHash
      })
    }

    return reply.status(200).send({
      currentHash,
      databases
    })
  } catch (error: any) {
    if (pool) {
      try { await pool.end() } catch (_) {}
    }
    console.error('Erro ao ler status dos bancos:', error)
    return reply.status(500).send({ message: 'Erro ao ler status dos bancos', details: error.message })
  }
}
