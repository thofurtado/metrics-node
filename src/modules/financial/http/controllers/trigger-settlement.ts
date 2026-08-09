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

                // Atualiza a transação na conta transitória
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: {
                        confirmed: true,
                        data_vencimento: new Date(),
                        description: `${cleanDescription} (Liquidado)`
                    }
                })

                // Cria a transação de entrada na conta final
                const destTx = await prisma.transaction.create({
                    data: {
                        operation: 'income',
                        amount: tx.amount,
                        totalValue: tx.amount,
                        description: `Liquidação: ${cleanDescription}`,
                        account_id: targetAccountId,
                        confirmed: true,
                        payment_method: tx.payment_method,
                        data_vencimento: new Date(),
                        data_emissao: tx.data_emissao,
                        cashier_session_id: tx.cashier_session_id,
                        interest: tx.interest,
                        category_id: tx.category_id,
                        sector_id: tx.sector_id,
                        client_id: tx.client_id,
                        supplier_id: tx.supplier_id,
                        employee_id: tx.employee_id,
                    }
                })

                // Vincula as duas na TransferTransaction (para histórico)
                await prisma.transferTransaction.create({
                    data: {
                        source_transaction_id: tx.id,
                        dest_transaction_id: destTx.id,
                    }
                })
                settledCount++;
            } else {
                // Fluxo normal direto na conta
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { 
                        confirmed: true,
                        data_vencimento: new Date()
                    }
                })
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
