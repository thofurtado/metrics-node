import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { z } from 'zod'
import { mappedStatus } from '@/modules/public/http/controllers/pedido-online-dto'

/**
 * GET /api/pdv/orders/situacao?uuids=a,b,c (chave do PDV), 13/10/2026: a situação atual de pedidos de DIAS ANTERIORES que o
 * PDV ainda tem abertos. A conferência de pedidos (/api/pdv/orders/pending) só traz o dia operacional; o iFood #5706 da Katatau
 * foi entregue às 22:28 com o PDV desligado e, no dia seguinte, ficou "Na rua" para sempre. Devolve só o código, a situação no
 * mesmo formato da conferência e a situação de entrega (sem dado de cliente). Até 50 pedidos por vez.
 */
export async function getOrdersSituation(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (requestContext.get as any)('prisma')
  if (!prisma) return reply.status(500).send({ message: 'Loja não identificada.' })

  const { uuids } = z.object({ uuids: z.string().min(1) }).parse(request.query)
  const lista = [...new Set(uuids.split(',').map(u => u.trim()).filter(u => /^[0-9a-f-]{36}$/i.test(u)))].slice(0, 50)
  if (lista.length === 0) return reply.status(200).send({ orders: [] })

  const pedidos: { uuid: string; status: string; status_delivery: string | null }[] = await prisma.pedido.findMany({
    where: { uuid: { in: lista } },
    select: { uuid: true, status: true, status_delivery: true },
  })
  return reply.status(200).send({
    orders: pedidos.map(p => ({ id: p.uuid, status: mappedStatus(p.status_delivery, p.status), status_delivery: p.status_delivery || 'Pendente' })),
  })
}
