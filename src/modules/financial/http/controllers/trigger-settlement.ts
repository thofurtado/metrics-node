import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function triggerSettlement(request: FastifyRequest, reply: FastifyReply) {
    try {
        const querySchema = z.object({
            onlyToday: z.string().optional().default('true'),
            transactionIds: z.union([z.string(), z.array(z.string())]).optional(),
        })
        const bodySchema = z.object({
            transactionIds: z.array(z.string()).optional()
        }).optional()

        const queryParams = querySchema.parse(request.query)
        const bodyParams = request.body ? bodySchema.parse(request.body) : {}
        
        let idsToSettle: string[] = []
        if (bodyParams?.transactionIds && bodyParams.transactionIds.length > 0) {
            idsToSettle = bodyParams.transactionIds
        } else if (queryParams.transactionIds) {
            idsToSettle = Array.isArray(queryParams.transactionIds) ? queryParams.transactionIds : [queryParams.transactionIds]
        }

        const today = new Date()
        today.setHours(23, 59, 59, 999)

        // Busca transações de cartões/pix não confirmadas
        const whereClause: any = {
            confirmed: false,
            operation: 'income',
            payment_method: { notIn: ['A PRAZO', 'PERMUTA', 'DINHEIRO', 'CAIXA'] }
        }

        if (idsToSettle.length > 0) {
            whereClause.id = { in: idsToSettle }
            // Se passou IDs específicos, ignora a data de vencimento (permite adiantar futuro)
        } else if (queryParams.onlyToday === 'true') {
            whereClause.data_vencimento = { lte: today }
        }

        const pendingTransactions = await prisma.transaction.findMany({
            where: whereClause
        })

        if (pendingTransactions.length === 0) {
            return reply.status(200).send({ message: 'Nenhuma liquidação pendente encontrada.', settledCount: 0 })
        }

        // Executar a liquidação (Apenas marcar como true e ajustar a data de vencimento para hoje para aparecer no fluxo de caixa de hoje)
        const txIds = pendingTransactions.map(t => t.id)
        
        await prisma.transaction.updateMany({
            where: { id: { in: txIds } },
            data: { 
                confirmed: true,
                data_vencimento: new Date() // Atualiza para a data real do depósito no banco
            }
        })

        return reply.status(200).send({ 
            message: `${pendingTransactions.length} liquidações efetivadas com sucesso.`, 
            settledCount: pendingTransactions.length
        })
    } catch (error: any) {
        console.error('[triggerSettlement Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar cartões.' })
    }
}
