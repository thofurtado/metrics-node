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
            payment_method: { 
                in: [
                    'CREDITO', 'DEBITO', 'PIX', 'VOUCHER', 
                    'crédito', 'débito', 'pix', 'voucher',
                    'Crédito', 'Débito', 'Pix', 'Voucher',
                    'Cartão de Crédito', 'Cartão de Débito',
                    'cartão de crédito', 'cartão de débito',
                    'Cartão de crédito', 'Cartão de débito'
                ] 
            }
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

        let settledCount = 0;

        for (const tx of pendingTransactions) {
            const destMatch = tx.description?.match(/\[DEST:\s*([^\]]+)\]/)
            const targetAccountId = destMatch ? destMatch[1] : null

            if (targetAccountId) {
                // Tem conta de destino, então estava na transitória. Fazer transferência.
                const cleanDescription = tx.description?.replace(/\[DEST:\s*[^\]]+\]/, '').trim() || 'Liquidação'

                // Atualiza a própria transação movendo-a para a conta real
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: {
                        confirmed: true,
                        account_id: targetAccountId,
                        description: `${cleanDescription} (Liquidado)`
                    }
                })

                // Atualiza o saldo da conta destino com o valor LÍQUIDO (totalValue)
                await prisma.account.update({
                    where: { id: targetAccountId },
                    data: { balance: { increment: tx.totalValue || tx.amount } }
                })
                
                settledCount++;
            } else {
                // Fluxo normal direto na conta
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { 
                        confirmed: true
                    }
                })

                // Se era direto na conta, atualizar saldo!
                if (tx.account_id) {
                    await prisma.account.update({
                        where: { id: tx.account_id },
                        data: { balance: { increment: tx.totalValue || tx.amount } }
                    })
                }
                settledCount++;
            }
        }

        return reply.status(200).send({ 
            message: `${settledCount} liquidações efetivadas com sucesso.`, 
            settledCount: settledCount
        })
    } catch (error: any) {
        console.error('[triggerSettlement Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar cartões.' })
    }
}
