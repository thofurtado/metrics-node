import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface TerminateTransactionGroupRequest {
    groupId: string
    lastKeptTransactionId: string
}

export class TerminateTransactionGroupUseCase {
    constructor(private transactionsRepository: TransactionsRepository) { }

    async execute({ groupId, lastKeptTransactionId }: TerminateTransactionGroupRequest): Promise<{ apagadas: number, pagasMantidas: number }> {

        // Use 'any' cast if properties are missing in type definition but exist in schema
        const group = await (prisma as any).transactionGroup.findUnique({
            where: { id: groupId },
            include: { transactions: true }
        })

        if (!group) {
            throw new ResourceNotFoundError()
        }

        const lastKeptTransaction = group.transactions.find((t: any) => t.id === lastKeptTransactionId)

        if (!lastKeptTransaction) {
            throw new ResourceNotFoundError()
        }

        // Fase 1 do Mergulho (13:D3): comparava o campo t.date, que não existe na tabela (o vencimento é
        // data_vencimento). A data virava "não é número", nenhuma parcela era escolhida e a rota respondia
        // sucesso sem apagar nada. Agora compara o vencimento. Parcela já paga ou gerada pela conferência de
        // caixa nunca é apagada aqui (mesma regra do apagar comum): fica no grupo.
        const limite = new Date(lastKeptTransaction.data_vencimento).getTime()
        const futuras = group.transactions.filter((t: any) => new Date(t.data_vencimento).getTime() > limite)
        const transactionsToDelete = futuras.filter((t: any) => !t.confirmed && !t.cashier_session_id)
        const pagasMantidas = futuras.length - transactionsToDelete.length

        if (transactionsToDelete.length > 0) {
            await prisma.$transaction(async (tx) => {
                // Delete future transactions
                await tx.transaction.deleteMany({
                    where: {
                        id: { in: transactionsToDelete.map((t: any) => t.id) },
                        confirmed: false
                    }
                })

                // Recalculate Group totals based on what REMAINS
                // (Original list - Deleted list)
                const remainingTransactions = group.transactions.filter((t: any) => !transactionsToDelete.includes(t))

                const newCount = remainingTransactions.length
                const newTotal = remainingTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0)

                await (tx as any).transactionGroup.update({
                    where: { id: groupId },
                    data: {
                        installmentsCount: newCount,
                        totalAmount: newTotal
                    }
                })
            })
        }

        return { apagadas: transactionsToDelete.length, pagasMantidas }
    }
}
