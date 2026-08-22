import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'

const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: masterUrl })
    const result = await pool.query('SELECT "id", "name", "domain", "status" FROM "Tenant" WHERE status = $1 ORDER BY name ASC', ['active'])
    await pool.end()
    pool = null

    const formatted = result.rows.map((t) => ({
      id: String(t.id),
      name: t.name,
      identification: t.domain || '',
      groupId: '',
      groupName: 'Empresa',
    }))

    return reply.status(200).send({ clients: formatted })
  } catch (error: any) {
    if (pool) await pool.end().catch(() => {})
    console.error('[Windy] Erro ao buscar empresas:', error)
    return reply.status(500).send({ message: 'Erro ao carregar lista de empresas.', error: error.message })
  }
}

export async function bindDeviceFromWindy(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    identification: z.string(), // Nome do computador ou ID gerado
    clientId: z.string().optional(),
    macAddress: z.string().optional(),
    vpnIp: z.string().optional(),
  })

  const { identification, clientId, macAddress, vpnIp } = bodySchema.parse(request.body)

  if (!clientId) {
    return reply.status(400).send({ message: 'clientId (ID da empresa) é obrigatório.' })
  }

  let pool: Pool | null = null
  try {
    pool = new Pool({ connectionString: masterUrl })
    const result = await pool.query('SELECT "id", "name", "domain" FROM "Tenant" WHERE "id" = $1', [clientId])
    await pool.end()
    pool = null

    const tenant = result.rows[0]
    if (!tenant) {
      return reply.status(404).send({ message: 'Empresa não encontrada.' })
    }

    const headscaleUser = `client_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    await HeadscaleService.createOrGetUser(headscaleUser)
    const vpnAuthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)

    return reply.status(200).send({
      success: true,
      clientName: tenant.name,
      groupName: 'Rede Privada da Empresa',
      headscaleUser,
      vpnAuthKey,
      loginServer: 'https://vpn.metrics.dev.br',
    })
  } catch (error: any) {
    if (pool) await pool.end().catch(() => {})
    console.error('[Windy] Erro ao vincular dispositivo:', error)
    return reply.status(500).send({ message: 'Erro ao vincular empresa.', error: error.message })
  }
}
