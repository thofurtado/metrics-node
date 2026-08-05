import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function triggerSettlement(request: FastifyRequest, reply: FastifyReply) {
    try {
        const querySchema = z.object({
            onlyToday: z.string().optional().default('true')
        })
        const { onlyToday } = querySchema.parse(request.query)

        // Localizar a conta transitória
        const transitAccount = await prisma.account.findFirst({ where: { is_transit: true } })
        if (!transitAccount) {
            return reply.status(400).send({ message: 'Conta transitória não encontrada.' })
        }

        // Buscar transações na conta transitória que não estão confirmadas
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        const pendingTransactions = await prisma.transaction.findMany({
            where: {
                account_id: transitAccount.id,
                confirmed: false,
                operation: 'income',
                ...(onlyToday === 'true' ? { data_vencimento: { lte: today } } : {})
            }
        })

        if (pendingTransactions.length === 0) {
            return reply.status(200).send({ message: 'Nenhuma liquidação pendente encontrada.', settledCount: 0 })
        }

        let settledCount = 0

        for (const tx of pendingTransactions) {
            const taxPercentage = tx.interest || 0
            const feeAmount = (tx.amount * taxPercentage) / 100
            const netAmount = tx.amount - feeAmount

            // 1. Achar a conta real de destino
            const accounts = await prisma.account.findMany({ where: { is_transit: false } })
            const defaultAccount = accounts[0]
            
            let destAccountId = defaultAccount?.id
            const bankNameMatch = tx.description?.split('-')[1]?.trim().split(' ')[0]
            if (bankNameMatch) {
                const matchedAccount = accounts.find(a => a.name.toUpperCase().includes(bankNameMatch.toUpperCase()) || bankNameMatch.toUpperCase().includes(a.name.toUpperCase()))
                if (matchedAccount) destAccountId = matchedAccount.id
            }

            // 2. Criar a transação na Conta Real (Net Amount)
            const destTx = await prisma.transaction.create({
                data: {
                    operation: 'income',
                    amount: netAmount,
                    totalValue: netAmount,
                    description: `${tx.description} (Líquido)`,
                    account_id: destAccountId,
                    confirmed: true,
                    data_vencimento: new Date(),
                    data_emissao: tx.data_emissao,
                    payment_method: tx.payment_method,
                    cashier_session_id: tx.cashier_session_id
                }
            })

            // 3. Criar a Transferência que liga as duas (Mantém rastro de fee)
            await prisma.transferTransaction.create({
                data: {
                    source_transaction_id: tx.id,
                    dest_transaction_id: destTx.id,
                    fee_amount: feeAmount,
                    description: `Liquidação: ${tx.description}`,
                    is_automated: true
                }
            })

            // 4. Criar a Despesa da Taxa (Expense)
            if (feeAmount > 0) {
                await prisma.transaction.create({
                    data: {
                        operation: 'expense',
                        amount: feeAmount,
                        totalValue: feeAmount,
                        description: `Taxa Maquininha: ${tx.description}`,
                        account_id: destAccountId,
                        confirmed: true,
                        data_vencimento: new Date(),
                        data_emissao: tx.data_emissao,
                        payment_method: tx.payment_method,
                        parent_transaction_id: tx.id, // Liga à transação transitória
                        cashier_session_id: tx.cashier_session_id
                    }
                })
            }

            // 5. Confirmar a Transação na Conta Transitória
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { confirmed: true }
            })

            settledCount++
        }

        return reply.status(200).send({ 
            message: `${settledCount} transações liquidadas com sucesso.`, 
            settledCount 
        })
    } catch (error: any) {
        console.error('[triggerSettlement Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar cartões.' })
    }
}
