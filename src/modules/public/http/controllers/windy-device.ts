import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'
import { Pool } from 'pg'

const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Tentar buscar clientes locais no prisma
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        document: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    if (clients.length > 0) {
      const formatted = clients.map((c) => ({
        id: c.id,
        name: c.name,
        identification: c.document || '',
        groupId: '',
        groupName: 'Empresa',
      }))
      return reply.status(200).send({ clients: formatted })
    }

    // 2. Fallback para Tenants na base master
    let pool: Pool | null = null
    try {
      pool = new Pool({ connectionString: masterUrl })
      const result = await pool.query('SELECT "id", "name", "domain", "status" FROM "Tenant" WHERE status = $1 ORDER BY name ASC', ['active'])
      await pool.end()

      const formatted = result.rows.map((t) => ({
        id: String(t.id),
        name: t.name,
        identification: t.domain || '',
        groupId: '',
        groupName: 'Empresa',
      }))
      return reply.status(200).send({ clients: formatted })
    } catch {
      if (pool) await pool.end().catch(() => {})
      return reply.status(200).send({ clients: [] })
    }
  } catch (error: any) {
    console.error('[Windy] Erro ao buscar empresas:', error)
    return reply.status(500).send({ message: 'Erro ao carregar lista de empresas.', error: error.message })
  }
}

export async function bindDeviceFromWindy(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    identification: z.string().optional(), // Nome do computador ou ID
    hostname: z.string().optional(),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    macAddress: z.string().optional(),
    equipmentId: z.string().optional(),
    vpnIp: z.string().optional(),
  })

  const { identification, hostname, clientId, clientName, macAddress, equipmentId, vpnIp } = bodySchema.parse(request.body || {})

  let resolvedClientName = clientName || ''
  let resolvedClientId = clientId || ''

  try {
    // 1. Se veio clientId explícito, buscar dados do cliente
    if (resolvedClientId) {
      const client = await prisma.client.findUnique({
        where: { id: resolvedClientId },
        select: { id: true, name: true },
      })
      if (client) {
        resolvedClientName = client.name
      }
    }

    // 2. Se não encontrou por clientId, buscar pelo equipamento cadastrado no banco
    const searchTerms = [equipmentId, identification, hostname].filter(Boolean) as string[]
    if (!resolvedClientName && searchTerms.length > 0) {
      for (const term of searchTerms) {
        const eq = await prisma.equipment.findFirst({
          where: {
            OR: [
              { id: term },
              { id: { startsWith: term } },
              { identification: { contains: term, mode: 'insensitive' } },
              { details: { contains: term, mode: 'insensitive' } },
            ],
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        if (eq?.client) {
          resolvedClientId = eq.client.id
          resolvedClientName = eq.client.name
          break
        }
      }
    }

    // 3. Fallback inteligente para Eureca Tech ou Empresa Padrão
    if (!resolvedClientName) {
      const defaultClient = await prisma.client.findFirst({
        where: {
          name: { contains: 'Eureca', mode: 'insensitive' },
        },
        select: { id: true, name: true },
      })

      if (defaultClient) {
        resolvedClientId = defaultClient.id
        resolvedClientName = defaultClient.name
      } else {
        resolvedClientName = 'Eureca Tech'
      }
    }

    // 4. Criação do namespace de usuário no Headscale
    const headscaleUser = `client_${resolvedClientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    await HeadscaleService.createOrGetUser(headscaleUser)
    const vpnAuthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)

    return reply.status(200).send({
      success: true,
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      groupName: `Rede Privada (${resolvedClientName})`,
      headscaleUser,
      vpnAuthKey,
      loginServer: 'https://vpn.metrics.dev.br',
    })
  } catch (error: any) {
    console.error('[Windy] Erro ao vincular dispositivo:', error)
    return reply.status(500).send({ message: 'Erro ao vincular empresa.', error: error.message })
  }
}
