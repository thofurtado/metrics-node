import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface DeleteFutureTransactionsRequest {
    transactionId: string
}

export class DeleteFutureTransactionsUseCase {
    constructor(private transactionsRepository: TransactionsRepository) {}

    async execute({ transactionId }: DeleteFutureTransactionsRequest) {
        const referenceTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { transactionGroup: true }
        })

        if (!referenceTransaction) throw new ResourceNotFoundError()
        if (!referenceTransaction.transaction_group_id) {
            // Se não faz parte de um grupo, apenas exclui ela mesma.
            await this.transactionsRepository.delete(transactionId)
            return {}
        }

        // Buscar todas as transações do grupo que vencem depois ou na mesma data
        const futureTransactions = await prisma.transaction.findMany({
            where: {
                transaction_group_id: referenceTransaction.transaction_group_id,
                data_vencimento: {
                    gte: referenceTransaction.data_vencimento
                }
            }
        })

        for (const tx of futureTransactions) {
            // Não ignoramos a atualização do grupo, 
            // pois queremos que o grupo continue existindo com as transações passadas
            await this.transactionsRepository.delete(tx.id, false)
        }

        return {}
    }
}
