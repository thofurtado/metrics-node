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

        // Localizar a transação pendente
        const pendingTx = await prisma.transaction.findUnique({
            where: { id: transactionId }
        })

        if (!pendingTx) {
            return reply.status(404).send({ message: 'Transação não encontrada.' })
        }

        if (pendingTx.confirmed) {
            return reply.status(400).send({ message: 'Transação já foi liquidada/confirmada.' })
        }

        // Executar em transação atômica
        await prisma.$transaction(async (tx) => {
            if (isWriteOff) {
                // Baixa sem movimentação de saldo (Permuta)
                await tx.transaction.update({
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
                    throw new Error('Conta de destino é obrigatória para recebimentos normais.')
                }
                
                // 1. Criar a transação real de RECEITA na Conta Real com o método físico
                const destTx = await tx.transaction.create({
                    data: {
                        operation: 'income',
                        amount: pendingTx.amount,
                        totalValue: pendingTx.amount,
                        description: `${pendingTx.description} (Liquidado)`,
                        account_id: targetAccountId,
                        confirmed: true,
                        data_vencimento: new Date(),
                        data_emissao: pendingTx.data_emissao,
                        payment_method: actualPaymentMethod || 'DINHEIRO',
                    }
                })
                
                await tx.transaction.update({
                    where: { id: transactionId },
                    data: { 
                        confirmed: true,
                        parent_transaction_id: destTx.id,
                        operation: 'transfer' // Evita dupla contagem nos relatórios globais de income se necessário
                    }
                })
            }
        })

        return reply.status(200).send({ message: 'Liquidação de fiado/a prazo concluída com sucesso!' })
    } catch (error: any) {
        console.error('[settleTermDebt Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar débito.' })
    }
}
