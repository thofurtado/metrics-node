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

        // Agrupar transações
        // Chave do grupo: "YYYY-MM-DD|Banco Bandeira"
        const groups = new Map<string, {
            transactions: typeof pendingTransactions,
            totalAmount: number,
            totalFee: number,
            bankNameRaw: string,
            paymentMethod: string,
            dataEmissao: Date,
            dataVencimento: Date
        }>()

        for (const tx of pendingTransactions) {
            const taxPercentage = tx.interest || 0
            const feeAmount = (tx.amount * taxPercentage) / 100

            // O description vem no formato: "Caixa Almoço Admin 05/08/2026 - SAFRA Crédito"
            const bankAndMethod = tx.description?.split('-')[1]?.trim() || 'Desconhecido'
            const bankNameRaw = bankAndMethod.split(' ')[0] || 'Desconhecido'
            const paymentMethod = tx.payment_method || 'Cartão'
            
            const dateStr = tx.data_emissao.toISOString().split('T')[0]
            const key = `${dateStr}|${bankAndMethod}`

            if (!groups.has(key)) {
                groups.set(key, {
                    transactions: [],
                    totalAmount: 0,
                    totalFee: 0,
                    bankNameRaw,
                    paymentMethod,
                    dataEmissao: tx.data_emissao,
                    dataVencimento: tx.data_vencimento
                })
            }

            const group = groups.get(key)!
            group.transactions.push(tx)
            group.totalAmount += tx.amount
            group.totalFee += feeAmount
        }

        let settledGroupsCount = 0

        // 1. Achar a conta real padrão (fallback)
        const accounts = await prisma.account.findMany({ where: { is_transit: false } })
        const defaultAccount = accounts[0]

        // Processar cada grupo
        for (const [key, group] of groups.entries()) {
            const netAmount = group.totalAmount - group.totalFee
            const [dateStr, bankAndMethod] = key.split('|')

            // Determinar conta de destino
            let destAccountId = defaultAccount?.id
            if (group.bankNameRaw !== 'Desconhecido') {
                const matchedAccount = accounts.find(a => 
                    a.name.toUpperCase().includes(group.bankNameRaw.toUpperCase()) || 
                    group.bankNameRaw.toUpperCase().includes(a.name.toUpperCase())
                )
                if (matchedAccount) destAccountId = matchedAccount.id
            }

            // Converter dateStr para Date no formato DD/MM/YYYY para a descrição
            const [year, month, day] = dateStr.split('-')
            const displayDate = `${day}/${month}/${year}`

            // Executar em transação atômica
            await prisma.$transaction(async (tx) => {
                // 1. Criar a transação consolidada de RECEITA na Conta Real
                const destTx = await tx.transaction.create({
                    data: {
                        operation: 'income',
                        amount: netAmount,
                        totalValue: netAmount,
                        description: `Liquidação Consolidada: ${bankAndMethod} (${displayDate})`,
                        account_id: destAccountId,
                        confirmed: true,
                        data_vencimento: new Date(),
                        data_emissao: group.dataEmissao,
                        payment_method: group.paymentMethod,
                        // cashier_session_id não é passado pois esta é a transação consolidada e o extrato geral deve vê-la
                    }
                })

                // 2. Criar a transação consolidada de DESPESA (Taxas) na Conta Real
                if (group.totalFee > 0) {
                    await tx.transaction.create({
                        data: {
                            operation: 'expense',
                            amount: group.totalFee,
                            totalValue: group.totalFee,
                            description: `Taxas Consolidadas: ${bankAndMethod} (${displayDate})`,
                            account_id: destAccountId,
                            confirmed: true,
                            data_vencimento: new Date(),
                            data_emissao: group.dataEmissao,
                            payment_method: group.paymentMethod,
                            parent_transaction_id: destTx.id // Liga à transação consolidada
                        }
                    })
                }

                // 3. Marcar as transações originais transitórias como confirmadas
                // e associá-las à transação consolidada via parent_transaction_id
                const originalTxIds = group.transactions.map(t => t.id)
                await tx.transaction.updateMany({
                    where: { id: { in: originalTxIds } },
                    data: { 
                        confirmed: true,
                        parent_transaction_id: destTx.id 
                    }
                })
            })

            settledGroupsCount++
        }

        return reply.status(200).send({ 
            message: `${settledGroupsCount} lotes (agrupados) liquidados com sucesso.`, 
            settledCount: pendingTransactions.length,
            settledGroupsCount
        })
    } catch (error: any) {
        console.error('[triggerSettlement Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar cartões.' })
    }
}
