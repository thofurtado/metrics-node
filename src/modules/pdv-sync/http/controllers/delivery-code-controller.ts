import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { z } from 'zod'
import { ifoodApi } from '@/modules/delivery/services/ifood-api.service'
import { getValidAccessToken } from '@/modules/delivery/services/ifood-poller'
import { extractIfoodOrderId } from '@/modules/delivery/services/delivery-order-lifecycle.service'
import { codigoDeEntregaValido, resultadoDoCodigoDeEntrega } from '@/modules/delivery/services/ifood-codigo-entrega'

/**
 * POST /api/pdv/orders/:id/delivery-code { code } (12/10/2026): o PDV manda o código de entrega que o cliente passou ao motoboy
 * e a nuvem confirma no iFood (ver ifood-codigo-entrega.ts). Responde sempre 200 com { ok, mensagem } para o PDV mostrar;
 * nada muda no pedido daqui: quem leva o pedido a "Entregues" é o evento do iFood (CON), pelo polling.
 */
export async function postIfoodDeliveryCode(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (requestContext.get as any)('prisma')
  const dbName = (requestContext.get as any)('tenant') as string | undefined
  if (!prisma || !dbName) return reply.status(500).send({ ok: false, mensagem: 'Loja não identificada.' })

  const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
  const { code } = z.object({ code: z.any() }).parse(request.body ?? {})
  const codigo = codigoDeEntregaValido(code)
  if (!codigo) return reply.status(200).send({ ok: false, mensagem: 'Digite o código de entrega (4 dígitos) que o cliente mostrou no app.' })

  const pedido = await prisma.pedido.findFirst({ where: { uuid: id }, select: { id: true, observacao: true } })
  if (!pedido) return reply.status(200).send({ ok: false, mensagem: 'Pedido não encontrado na nuvem.' })
  const orderId = extractIfoodOrderId(pedido.observacao)
  if (!orderId) return reply.status(200).send({ ok: false, mensagem: 'Este pedido não é do iFood.' })

  const token = await getValidAccessToken(dbName)
  if (!token) return reply.status(200).send({ ok: false, mensagem: 'A conexão com o iFood está indisponível. Tente de novo em instantes.' })

  try {
    const r = await ifoodApi.verifyDeliveryCode(token, orderId, codigo)
    return reply.status(200).send(resultadoDoCodigoDeEntrega(r.status, r.corpo))
  } catch (err: any) {
    return reply.status(200).send({ ok: false, mensagem: `Não foi possível falar com o iFood agora (${err?.message || err}).` })
  }
}
