import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function settleTermDebt(request: FastifyRequest, reply: FastifyReply) {
    try {
        const bodySchema = z.object({
            transactionId: z.string().uuid(),
            targetAccountId: z.string().uuid().optional().nullable(),
            actualPaymentMethod: z.string().optional().nullable(),
            isWriteOff: z.boolean().default(false)
        })

        const { transactionId, targetAccountId, actualPaymentMethod, isWriteOff } = bodySchema.parse(request.body)

        const pendingTx = await prisma.transaction.findUnique({
            where: { id: transactionId }
        })

        if (!pendingTx) {
            return reply.status(404).send({ message: 'Transação não encontrada.' })
        }

        if (pendingTx.confirmed) {
            return reply.status(400).send({ message: 'Transação já foi liquidada/confirmada.' })
        }

        if (isWriteOff) {
            // Baixa sem movimentação de saldo real (Permuta)
            await prisma.transaction.update({
                where: { id: transactionId },
                data: {
                    confirmed: true,
                    payment_method: 'PERMUTA BAIXADA',
                    operation: 'cashier_summary',
                    description: `${pendingTx.description} (Baixado por Permuta)`
                }
            })
        } else {
            if (!targetAccountId) {
                return reply.status(400).send({ message: 'Conta de destino é obrigatória para recebimentos normais.' })
            }
            
            // Atualiza a transação pendente para confirmada na conta de destino real
            await prisma.transaction.update({
                where: { id: transactionId },
                data: { 
                    confirmed: true,
                    account_id: targetAccountId,
                    payment_method: actualPaymentMethod || 'DINHEIRO',
                    data_vencimento: new Date(),
                    description: `${pendingTx.description} (Liquidado)`
                }
            })
        }

        return reply.status(200).send({ message: 'Liquidação concluída com sucesso!' })
    } catch (error: any) {
        console.error('[settleTermDebt Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar débito.' })
    }
}
