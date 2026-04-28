import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface ReadjustTransactionGroupRequest {
    groupId: string
    mode: 'renegotiate' | 'fix'
    installmentsCount: number
    totalAmount?: number
    firstDueDate: Date
}

export class ReadjustTransactionGroupUseCase {
    constructor(private transactionsRepository: TransactionsRepository) {}

    async execute(data: ReadjustTransactionGroupRequest) {
        const { groupId, mode, installmentsCount, totalAmount, firstDueDate } = data

        const group = await prisma.transactionGroup.findUnique({
            where: { id: groupId },
            include: { transactions: true }
        })

        if (!group) throw new ResourceNotFoundError()

        // Separar pagas de pendentes
        const confirmedTransactions = group.transactions.filter(t => t.confirmed)
        const pendingTransactions = group.transactions.filter(t => !t.confirmed)

        const alreadyPaidAmount = confirmedTransactions.reduce((acc, t) => acc + (t.totalValue ?? t.amount), 0)
        const alreadyPaidCount = confirmedTransactions.length

        // Variáveis do novo cenário
        let newPendingCount = 0
        let newPendingAmount = 0
        let newGroupTotalAmount = 0
        let newGroupTotalCount = 0

        if (mode === 'fix') {
            // O usuário informou o NOVO Total do Contrato e o NOVO Total de Parcelas
            if (!totalAmount) throw new Error("Total amount is required for 'fix' mode")
            if (installmentsCount <= alreadyPaidCount) {
                throw new Error("O novo número total de parcelas deve ser maior que a quantidade já paga.")
            }
            if (totalAmount <= alreadyPaidAmount) {
                throw new Error("O novo valor total deve ser maior que o valor já pago.")
            }

            newGroupTotalAmount = totalAmount
            newGroupTotalCount = installmentsCount
            
            newPendingCount = newGroupTotalCount - alreadyPaidCount
            newPendingAmount = newGroupTotalAmount - alreadyPaidAmount
        } else if (mode === 'renegotiate') {
            // O usuário informou o NOVO número de parcelas RESTANTES e (opcionalmente) um NOVO valor para esse resto.
            newPendingCount = installmentsCount
            
            if (totalAmount !== undefined && totalAmount > 0) {
                newPendingAmount = totalAmount // Renegociou o saldo com juros ou desconto
            } else {
                newPendingAmount = pendingTransactions.reduce((acc, t) => acc + t.amount, 0) // Manteve o saldo
            }

            newGroupTotalAmount = alreadyPaidAmount + newPendingAmount
            newGroupTotalCount = alreadyPaidCount + newPendingCount
        } else {
            throw new Error("Invalid mode")
        }

        // Apagar as pendentes atuais (com skipGroupUpdate = true)
        for (const tx of pendingTransactions) {
            await this.transactionsRepository.delete(tx.id, true)
        }

        // Atualizar os totais do grupo
        await prisma.transactionGroup.update({
            where: { id: groupId },
            data: {
                totalAmount: newGroupTotalAmount,
                installmentsCount: newGroupTotalCount
            }
        })

        // Se não sobraram parcelas pendentes para criar, encerra aqui (improvável devido às validações, mas seguro)
        if (newPendingCount <= 0) return {}

        // Obter informações base da primeira transação para copiar conta, setor, descrição, etc
        const baseTransaction = group.transactions[0]
        const installmentValue = newPendingAmount / newPendingCount

        // Criar as novas parcelas
        for (let i = 0; i < newPendingCount; i++) {
            const dueDate = new Date(firstDueDate)
            dueDate.setMonth(dueDate.getMonth() + i)

            await prisma.transaction.create({
                data: {
                    operation: baseTransaction.operation,
                    data_vencimento: dueDate,
                    data_emissao: new Date(),
                    amount: installmentValue,
                    description: `${group.description || baseTransaction.description} (${alreadyPaidCount + i + 1}/${newGroupTotalCount})`,
                    confirmed: false,
                    account_id: baseTransaction.account_id,
                    sector_id: baseTransaction.sector_id,
                    supplier_id: baseTransaction.supplier_id,
                    payment_method: baseTransaction.payment_method,
                    transaction_group_id: groupId
                }
            })
        }

        return {}
    }
}
