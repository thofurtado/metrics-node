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

import { getPrismaForDb } from '@/lib/tenant-manager'

/**
 * Consulta últimos pedidos de delivery salvos em db_restaurante
 */
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
