import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TransactionAlreadyConfirmedError } from '@/modules/financial/use-cases/transaction-already-confirmed-error'

interface DeleteFutureTransactionsRequest {
    transactionId: string
}

// Fase 1 do Mergulho (13:D9): o "Excluir esta e as seguintes" apagava também as parcelas JÁ PAGAS do grupo; ao
// apagar uma paga, o valor voltava para o saldo da conta (o pagamento sumia e o dinheiro "voltava"). O apagar
// comum recusa parcela paga e lançamento da conferência de caixa; este caminho agora segue a mesma regra:
// apaga só as parcelas em aberto e mantém as pagas.
export class DeleteFutureTransactionsUseCase {
    constructor(private transactionsRepository: TransactionsRepository) {}

    async execute({ transactionId }: DeleteFutureTransactionsRequest): Promise<{ apagadas: number, pagasMantidas: number }> {
        const referenceTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { transactionGroup: true }
        })

        if (!referenceTransaction) throw new ResourceNotFoundError()
        if (!referenceTransaction.transaction_group_id) {
            // Se não faz parte de um grupo, apenas exclui ela mesma (com as regras do apagar comum).
            if (referenceTransaction.confirmed) throw new TransactionAlreadyConfirmedError()
            if ((referenceTransaction as any).cashier_session_id) {
                throw new Error('Este lançamento foi gerado pela conferência de caixa. Para corrigi-lo, reverta e refaça a conferência do caixa correspondente.')
            }
            await this.transactionsRepository.delete(transactionId)
            return { apagadas: 1, pagasMantidas: 0 }
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

        const emAberto = futureTransactions.filter(t => !t.confirmed && !(t as any).cashier_session_id)
        if (emAberto.length === 0) {
            throw new Error('Não há parcelas em aberto para excluir a partir desta: as parcelas pagas não são apagadas.')
        }

        for (const tx of emAberto) {
            // Não ignoramos a atualização do grupo, 
            // pois queremos que o grupo continue existindo com as transações passadas
            await this.transactionsRepository.delete(tx.id, false)
        }

        return { apagadas: emAberto.length, pagasMantidas: futureTransactions.length - emAberto.length }
    }
}
