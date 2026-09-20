import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { extractIfoodOrderId } from '@/modules/delivery/services/delivery-order-lifecycle.service'
import { getValidAccessToken } from '@/modules/delivery/services/ifood-poller'
import { ifoodApi } from '@/modules/delivery/services/ifood-api.service'
import { writeJournal } from '@/modules/delivery/services/ifood-events.service'

/**
 * Motivos de cancelamento válidos AGORA para o pedido (exigência da homologação do iFood:
 * a lista vem do iFood e é mostrada ao operador; nunca é fixa no PDV).
 * Pedidos que não são do iFood respondem supported=false.
 */
export async function getOrderCancellationReasons(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')
  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
  }

  const { id } = z.object({ id: z.string() }).parse(request.params)

  try {
    const pedido = await prisma.pedido.findFirst({
      where: { OR: [{ uuid: id }, { id: !isNaN(Number(id)) ? Number(id) : undefined }] },
    })
    if (!pedido) {
      return reply.status(404).send({ message: 'Pedido não encontrado.' })
    }

    const externalOrderId = extractIfoodOrderId(pedido.observacao)
    if (!externalOrderId) {
      return reply.status(200).send({ supported: false, reasons: [] })
    }

    const tenant = requestContext.get('tenant') as string | undefined
    const token = await getValidAccessToken(tenant)
    if (!token) {
      return reply.status(503).send({ message: 'A conexão com o iFood está indisponível.' })
    }

    const result = await ifoodApi.listCancellationReasons(token, externalOrderId)
    if (!result.ok) {
      // 424 (e não 502): o Cloudflare troca o corpo de qualquer 502 por "error code: 502" e o motivo real se perde.
      const podeTerTerminado = [400, 404, 409].includes(result.status)
      void writeJournal({
        method: 'PDV',
        endpoint: '/pdv/motivos-indisponiveis',
        orderId: externalOrderId,
        response: { ifoodStatus: result.status, ifoodError: String(result.error || '').slice(0, 400) },
        success: false,
      })
      return reply.status(424).send({
        message: podeTerTerminado
          ? `O iFood não liberou os motivos de cancelamento (resposta ${result.status}). O pedido pode já ter sido concluído ou cancelado no iFood, ou não estar mais em um momento que permita cancelar.`
          : `O iFood não liberou os motivos de cancelamento agora (resposta ${result.status || 'sem resposta'}).`,
        ifood_status: result.status,
        ifood_error: String(result.error || '').slice(0, 400),
      })
    }

    void writeJournal({
      method: 'PDV',
      endpoint: '/pdv/motivos-exibidos',
      orderId: externalOrderId,
      response: { count: result.reasons.length, reasons: result.reasons.map((r) => `${r.code}: ${r.description}`) },
    })
    return reply.status(200).send({ supported: true, reasons: result.reasons })
  } catch (error) {
    console.error('Erro ao consultar motivos de cancelamento:', error)
    return reply.status(500).send({ message: 'Erro ao consultar motivos de cancelamento.' })
  }
}
