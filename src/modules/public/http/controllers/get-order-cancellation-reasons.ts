import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { extractIfoodOrderId } from '@/modules/delivery/services/delivery-order-lifecycle.service'
import { getValidAccessToken } from '@/modules/delivery/services/ifood-poller'
import { ifoodApi } from '@/modules/delivery/services/ifood-api.service'

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
      return reply.status(502).send({
        message: 'Não foi possível consultar os motivos de cancelamento no iFood agora.',
        status: result.status,
      })
    }

    return reply.status(200).send({ supported: true, reasons: result.reasons })
  } catch (error) {
    console.error('Erro ao consultar motivos de cancelamento:', error)
    return reply.status(500).send({ message: 'Erro ao consultar motivos de cancelamento.' })
  }
}
