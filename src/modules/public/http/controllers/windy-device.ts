import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'
import { Pool } from 'pg'

const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Tentar buscar clientes locais no prisma com grupo vinculado
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        document: true,
        group_id: true,
        group: {
          select: {
            id: true,
            name: true,
          },
        },
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
        groupId: c.group_id || '',
        groupName: c.group ? `Grupo: ${c.group.name}` : 'Isolado (Sem Grupo)',
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
        groupName: 'Isolado (Sem Grupo)',
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
    tenantDomain: z.string().optional(),
    macAddress: z.string().optional(),
    equipmentId: z.string().optional(),
    vpnIp: z.string().optional(),
  })

  const { identification, hostname, clientId, clientName, tenantDomain, macAddress, equipmentId, vpnIp } = bodySchema.parse(request.body || {})

  let resolvedClientName = clientName || ''
  let resolvedClientId = clientId || ''
  let resolvedClient: any = null

  try {
    // 1. Se veio clientId explícito, buscar dados do cliente com o grupo
    if (resolvedClientId) {
      resolvedClient = await prisma.client.findUnique({
        where: { id: resolvedClientId },
        include: { group: true },
      })
      if (resolvedClient) {
        resolvedClientName = resolvedClient.name
      }
    }

    // 2. Se não encontrou e tem tenantDomain, buscar pelo domínio/identificação
    if (!resolvedClient && tenantDomain) {
      resolvedClient = await prisma.client.findFirst({
        where: {
          OR: [
            { identification: { equals: tenantDomain, mode: 'insensitive' } },
            { name: { equals: tenantDomain, mode: 'insensitive' } },
          ],
        },
        include: { group: true },
      })
      if (resolvedClient) {
        resolvedClientId = resolvedClient.id
        resolvedClientName = resolvedClient.name
      }
    }

    // 3. Se não encontrou por clientId/tenantDomain, buscar pelo equipamento cadastrado no banco
    if (!resolvedClient) {
      const searchTerms = [equipmentId, identification, hostname, macAddress].filter(Boolean) as string[]
      if (searchTerms.length > 0) {
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
                include: { group: true },
              },
            },
          })

          if (eq?.client) {
            resolvedClient = eq.client
            resolvedClientId = eq.client.id
            resolvedClientName = eq.client.name
            break
          }
        }
      }
    }

    // 4. Determinação Dinâmica da Rede Headscale (Grupo vs Cliente Isolado)
    let headscaleUser: string
    let groupName: string

    if (resolvedClient) {
      if (resolvedClient.group) {
        // Pertence a um Grupo de Empresas: Todas as filiais e matriz compartilham o mesmo namespace do Grupo
        const cleanGroupName = resolvedClient.group.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        headscaleUser = resolvedClient.group.headscale_user || `group_${cleanGroupName}`
        groupName = `Grupo: ${resolvedClient.group.name}`
      } else {
        // Cliente Isolado: Cria um namespace privativo exclusivo para as máquinas deste cliente
        const safeName = resolvedClient.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)
        const shortId = resolvedClient.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
        headscaleUser = `client_${safeName}_${shortId}`
        groupName = `Rede Privada (${resolvedClient.name})`
      }
    } else {
      // Máquina avulsa sem cliente associado: isolar em namespace temporário da máquina
      resolvedClientName = clientName || 'Dispositivo Avulso'
      const cleanMachine = (hostname || identification || 'node').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)
      headscaleUser = `standalone_${cleanMachine}`
      groupName = `Rede Isolada (${cleanMachine})`
    }

    // 5. Garantir usuário e chave no Headscale para o namespace determinado
    await HeadscaleService.createOrGetUser(headscaleUser)
    const vpnAuthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)

    // Se for grupo e ainda não tinha chave ou user salvo, persistir
    if (resolvedClient?.group && (!resolvedClient.group.headscale_user || !resolvedClient.group.vpn_preauth_key)) {
      await prisma.clientGroup.update({
        where: { id: resolvedClient.group.id },
        data: {
          headscale_user: headscaleUser,
          vpn_preauth_key: vpnAuthKey,
        },
      }).catch((err) => console.warn('[Windy] Aviso ao salvar chave no grupo:', err.message))
    }

    return reply.status(200).send({
      success: true,
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      groupId: resolvedClient?.group?.id || null,
      groupName,
      headscaleUser,
      vpnAuthKey,
      loginServer: 'https://vpn.metrics.dev.br',
      debug: {
        hasApiKey: Boolean(process.env.HEADSCALE_API_KEY),
        apiKeyLength: (process.env.HEADSCALE_API_KEY || '').length,
        apiKeyStart: (process.env.HEADSCALE_API_KEY || '').substring(0, 12),
        headscaleUrl: process.env.HEADSCALE_URL || 'https://vpn.metrics.dev.br',
        headscaleLastError: HeadscaleService.lastError,
      },
    })
  } catch (error: any) {
    console.error('[Windy] Erro ao vincular dispositivo:', error)
    return reply.status(500).send({ message: 'Erro ao vincular empresa.', error: error.message })
  }
}
