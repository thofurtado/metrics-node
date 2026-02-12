import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface TerminateTransactionGroupRequest {
    groupId: string
    lastKeptTransactionId: string
}

export class TerminateTransactionGroupUseCase {
    constructor(private transactionsRepository: TransactionsRepository) { }

    async execute({ groupId, lastKeptTransactionId }: TerminateTransactionGroupRequest): Promise<void> {

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

        const transactionsToDelete = group.transactions.filter((t: any) => {
            return new Date(t.date).getTime() > new Date(lastKeptTransaction.date).getTime()
        })

        if (transactionsToDelete.length > 0) {
            await prisma.$transaction(async (tx) => {
                // Delete future transactions
                await tx.transaction.deleteMany({
                    where: {
                        id: { in: transactionsToDelete.map((t: any) => t.id) }
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
    }
}
