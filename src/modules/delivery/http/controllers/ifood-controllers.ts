import { FastifyReply, FastifyRequest } from 'fastify'
import { ifoodApi } from '../../services/ifood-api.service'
import { env } from '@/env'
import { recentDeliveryEvents } from './webhook-99food'

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
