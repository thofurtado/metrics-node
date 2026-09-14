import { FastifyReply, FastifyRequest } from 'fastify'
import { ifoodApi } from '../../services/ifood-api.service'
import { env } from '@/env'
import { recentDeliveryEvents } from './webhook-99food'
import { getValidAccessToken, setIfoodTokens } from '../../services/ifood-poller'
import { z } from 'zod'
import { getDbNameForDomain, getPrismaForDb } from '@/lib/tenant-manager'
import { requestContext } from '@fastify/request-context'


/**
 * Gera um novo UserCode para o lojista autorizar o Metrics no iFood
 */
export async function ifoodUserCodeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await ifoodApi.generateUserCode()
    return reply.status(200).send({
      message: 'Código de autorização iFood gerado com sucesso.',
      ...data,
    })
  } catch (err: any) {
    return reply.status(500).send({
      error: 'Falha ao conectar com a API do iFood',
      details: err.message,
    })
  }
}

/**
 * Finaliza a autorização OAuth2 do lojista e inicializa o polling com os tokens recebidos.
 */
export async function ifoodExchangeTokenController(request: FastifyRequest, reply: FastifyReply) {
  const schema = z.object({
    authorizationCode: z.string().min(1),
    authorizationCodeVerifier: z.string().min(1),
  })

  try {
    const { authorizationCode, authorizationCodeVerifier } = schema.parse(request.body)
    const tenantDbName = await resolveIfoodTenantDb(request)
    const tokens = await ifoodApi.exchangeCodeForToken(authorizationCode, authorizationCodeVerifier)
    setIfoodTokens(tokens, tenantDbName)

    const prisma = await getPrismaForDb(tenantDbName)
    const profile = await (prisma as any).companyProfile.findFirst()
    if (profile) {
      await (prisma as any).companyProfile.update({
        where: { id: profile.id },
        data: {
          ifoodAccessToken: tokens.accessToken,
          ifoodRefreshToken: tokens.refreshToken,
          ifoodTokenExpiresAt: new Date(Date.now() + (tokens.expiresIn || 21600) * 1000),
        },
      })
    }

    return reply.status(200).send({
      message: 'iFood autorizado com sucesso.',
      expiresIn: tokens.expiresIn,
      tokenType: tokens.type,
      tenant: tenantDbName,
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'authorizationCode e authorizationCodeVerifier são obrigatórios' })
    }
    return reply.status(502).send({ error: 'Falha ao concluir autorização iFood', details: err.message })
  }
}

/**
 * Diagnóstico geral do módulo de delivery
 */
export async function deliveryStatusController(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send({
    status: 'ONLINE',
    platforms: {
      ifood: {
        configured: !!(env.IFOOD_CLIENT_ID && env.IFOOD_CLIENT_SECRET),
        clientIdMasked: env.IFOOD_CLIENT_ID ? `${env.IFOOD_CLIENT_ID.slice(0, 8)}...` : 'NÃO CONFIGURADO',
        mode: 'Distribuído (OAuth2)',
      },
      food99: {
        configured: !!(env.FOOD99_APP_ID && env.FOOD99_SECRET),
        appId: env.FOOD99_APP_ID || 'NÃO CONFIGURADO',
        webhookUrl: 'https://api.metrics.dev.br/webhooks/99food',
      },
    },
    recentEventsCount: recentDeliveryEvents.length,
    recentEvents: recentDeliveryEvents.slice(0, 10),
    timestamp: new Date().toISOString(),
  })
}

async function resolveIfoodTenantDb(request: FastifyRequest): Promise<string> {
  const contextTenant = requestContext.get('tenant')
  if (contextTenant) return String(contextTenant)

  const rawDomain = request.headers['x-tenant-domain']
  if (typeof rawDomain === 'string' && rawDomain.trim()) {
    const dbName = await getDbNameForDomain(rawDomain.trim().split(':')[0])
    if (dbName) return dbName
  }

  // Compatibilidade temporária com a loja de teste já existente.
  return 'db_restaurante'
}

/**
 * Consulta últimos pedidos de delivery salvos em db_restaurante
 */
export async function ifoodTestCancellationPatchController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as { orderId?: string; reason?: string; cancellationCode?: string }
    if (!body?.orderId) {
      return reply.status(400).send({ error: 'orderId é obrigatório' })
    }

    const token = await getValidAccessToken()
    if (!token) {
      return reply.status(503).send({ error: 'Token iFood indisponível' })
    }

    const result = await ifoodApi.testCancellationPatch(
      token,
      body.orderId,
      body.reason,
      body.cancellationCode,
    )
    return reply.status(200).send(result)
  } catch (err: any) {
    return reply.status(502).send({ error: 'Falha ao executar PATCH iFood', details: err.message })
  }
}

export async function ifoodCancellationStatusController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orderId } = request.params as { orderId?: string }
    if (!orderId || !/^[a-zA-Z0-9-]+$/.test(orderId)) {
      return reply.status(400).send({ error: 'orderId inválido' })
    }

    const prisma = await getPrismaForDb('db_restaurante')
    const logs = await (prisma as any).ifoodApiLog.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        method: true,
        endpoint: true,
        response_status: true,
        duration_ms: true,
        success: true,
        created_at: true,
      },
    })

    return reply.status(200).send({
      orderId,
      logs: logs.map((log: any) => ({
        method: log.method,
        endpoint: log.endpoint,
        responseStatus: log.response_status,
        durationMs: log.duration_ms,
        success: log.success,
        createdAt: log.created_at,
      })),
    })
  } catch (err: any) {
    return reply.status(500).send({ error: err.message })
  }
}

export async function ifoodApiLogsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { orderId?: string; take?: string }
    const take = Math.min(Math.max(Number(query.take) || 50, 1), 200)
    const prisma = await getPrismaForDb('db_restaurante')
    const logs = await (prisma as any).ifoodApiLog.findMany({
      where: query.orderId ? { order_id: query.orderId } : undefined,
      orderBy: { created_at: 'desc' },
      take,
    })
    return reply.status(200).send({ tenant: 'db_restaurante', total: logs.length, logs })
  } catch (err: any) {
    return reply.status(500).send({ error: err.message })
  }
}

export async function deliveryOrdersController(request: FastifyRequest, reply: FastifyReply) {

  try {
    const prisma = await getPrismaForDb('db_restaurante')
    const orders = await (prisma as any).pedido.findMany({
      where: { origem: 'Delivery' },
      orderBy: { data_abertura: 'desc' },
      take: 10,
      include: {
        itens: true,
      },
    })
    return reply.status(200).send({
      tenant: 'db_restaurante',
      total: orders.length,
      orders: orders.map((o: any) => ({
        uuid: o.uuid,
        display_id: o.display_id,
        origem: o.origem,
        status_delivery: o.status_delivery,
        valor_final: o.valor_final,
        observacao: o.observacao,
        data_abertura: o.data_abertura,
        cliente: o.cliente?.name,
        itens: (o.itens || []).map((it: any) => ({
          name: it.observacao,
          quantidade: it.quantidade,
          valor_total: it.valor_total,
        })),
      })),
    })
  } catch (err: any) {
    return reply.status(500).send({ error: err.message })
  }
}


import { pollIfoodEvents, getIfoodTokenState } from '../../services/ifood-poller'

/**
 * Força uma checagem imediata de eventos no iFood
 */
export async function pollIfoodNowController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await pollIfoodEvents()
    return reply.status(200).send({
      message: 'Polling iFood executado com sucesso',
      ...result,
      tokenState: getIfoodTokenState(),
    })
  } catch (err: any) {
    return reply.status(500).send({
      error: 'Falha ao executar polling iFood',
      details: err.message,
    })
  }
}


import { catalogSyncService } from '../../services/catalog-sync.service'

/**
 * Sincroniza cardápio completo com iFood e 99Food
 */
export async function syncCatalogController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await catalogSyncService.syncCatalog('db_restaurante')
    return reply.status(200).send({
      message: 'Cardápio sincronizado com sucesso!',
      ...result,
    })
  } catch (err: any) {
    return reply.status(500).send({
      error: 'Falha ao sincronizar cardápio com marketplaces',
      details: err.message,
    })
  }
}
