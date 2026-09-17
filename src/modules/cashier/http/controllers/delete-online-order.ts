import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sseManager } from '@/lib/sse-manager'

export async function deleteOnlineOrder(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.sub
    if (!userId) {
        return reply.status(401).send({ message: 'Não autorizado.' })
    }

    const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    })

    if (requester?.role !== 'ADMIN') {
        return reply.status(403).send({ message: 'Apenas administradores podem excluir pedidos permanentemente.' })
    }

    const paramsSchema = z.object({
        id: z.string()
    })
    const { id } = paramsSchema.parse(request.params)

    const pedido = await prisma.pedido.findFirst({
        where: {
            OR: [
                { uuid: id },
                { id: !isNaN(Number(id)) ? Number(id) : undefined }
            ]
        },
        include: { itens: true }
    })

    if (!pedido) {
        return reply.status(404).send({ message: 'Pedido não encontrado.' })
    }

    // 1. Exclui lançamentos de caixa vinculados ao pedido se existirem
    // Busca por identificação com delimitador para não apagar prefixos (ex: #4 não apaga #40)
    await prisma.cashierEntry.deleteMany({
        where: {
            OR: [
                { identification: { startsWith: `Delivery #${pedido.display_id} ` } },
                { identification: { startsWith: `Delivery #${pedido.display_id} -` } },
                { identification: { equals: `Delivery #${pedido.display_id}` } },
                { identification: { startsWith: `Delivery #${pedido.id} ` } },
                { identification: { startsWith: `Delivery #${pedido.id} -` } },
                { identification: { equals: `Delivery #${pedido.id}` } },
                ...(pedido.caixa_id ? [{
                    origin: 'Delivery',
                    cashier_session_id: pedido.caixa_id,
                    amount: pedido.valor_final
                }] : [])
            ]
        }
    })

    // 2. Exclui os itens do pedido
    await prisma.pedidoItem.deleteMany({
        where: { pedido_id: pedido.id }
    })

    // 3. Exclui o pedido
    await prisma.pedido.delete({
        where: { id: pedido.id }
    })

    // 4. Emite evento SSE para sincronização imediata
    try {
        const rawDomain = (request.headers['x-tenant-domain'] as string) || request.hostname
        sseManager.notifyTenant(rawDomain, 'order_deleted', {
            id: pedido.uuid,
            display_id: pedido.display_id
        })
        sseManager.broadcast('order_deleted', {
            id: pedido.uuid,
            display_id: pedido.display_id
        }, rawDomain)
    } catch (e) {
        console.warn('[SSE] Erro ao emitir order_deleted:', e)
    }

    return reply.status(200).send({
        message: `Pedido #${pedido.display_id} e lançamentos de caixa associados foram excluídos permanentemente.`
    })
}
