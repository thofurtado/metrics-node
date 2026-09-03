import { FastifyRequest, FastifyReply } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function associateOrphanOrders(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    try {
        const { cashier_session_id } = request.body as { cashier_session_id: string }
        if (!cashier_session_id) {
            return reply.status(400).send({ message: 'cashier_session_id é obrigatório.' })
        }

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const orphanOrders = await prisma.pedido.findMany({
            where: {
                origem: 'Delivery',
                caixa_id: null,
                data_abertura: { gte: todayStart }
            }
        })

        if (orphanOrders.length === 0) {
            return reply.status(200).send({ message: 'Nenhum pedido órfão encontrado.', count: 0 })
        }

        let createdEntries = 0

        for (const order of orphanOrders) {
            await prisma.pedido.update({
                where: { id: order.id },
                data: { caixa_id: cashier_session_id }
            })

            if (order.status_delivery === 'Entregue' || order.status === 'Fechado') {
                let formaPgto = 'PIX'
                if (order.observacao?.includes('Dinheiro')) formaPgto = 'Dinheiro'
                else if (order.observacao?.includes('Débito')) formaPgto = 'Cartão de Débito'
                else if (order.observacao?.includes('Crédito')) formaPgto = 'Cartão de Crédito'

                let clientName = 'Cliente Online'
                if (order.cliente_id) {
                    const client = await prisma.client.findUnique({ where: { id: order.cliente_id } })
                    if (client?.name) clientName = client.name
                }

                await prisma.cashierEntry.create({
                    data: {
                        cashier_session_id,
                        amount: order.valor_final || 0,
                        payment_method: formaPgto,
                        origin: 'Delivery',
                        identification: `Delivery #${order.display_id} - ${clientName}`,
                        type: 'SALE',
                        client_id: order.cliente_id
                    }
                })
                createdEntries++
            }
        }

        return reply.status(200).send({
            message: `${orphanOrders.length} pedidos vinculados com sucesso ao caixa!`,
            count: orphanOrders.length,
            entriesCreated: createdEntries
        })
    } catch (error) {
        console.error('Erro ao vincular pedidos órfãos:', error)
        return reply.status(500).send({ message: 'Erro ao vincular pedidos órfãos.' })
    }
}
