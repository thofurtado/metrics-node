import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface DeleteTransactionGroupRequest {
    groupId: string
}

export class DeleteTransactionGroupUseCase {
    constructor(private transactionsRepository: TransactionsRepository) {}

    async execute({ groupId }: DeleteTransactionGroupRequest) {
        const group = await (prisma as any).transactionGroup.findUnique({
            where: { id: groupId },
            include: { transactions: true }
        })

        if (!group) throw new ResourceNotFoundError()

        for (const tx of group.transactions) {
            await this.transactionsRepository.delete(tx.id, true)
        }

        await (prisma as any).transactionGroup.delete({
            where: { id: groupId }
        })

        return {}
    }
}
