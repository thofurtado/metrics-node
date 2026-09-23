import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TransactionAlreadyConfirmedError } from '@/modules/financial/use-cases/transaction-already-confirmed-error'

interface DeleteTransactionUseCaseRequest {
    id: string
}
export class DeleteTransactionUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({
        id
    }: DeleteTransactionUseCaseRequest): Promise<void> {

        const transaction = await this.transactionsRepository.findById(id)
        if (!transaction) {
            throw new ResourceNotFoundError()
        }

        if (transaction.confirmed) {
            throw new TransactionAlreadyConfirmedError()
        }

        // A conferência de caixa é a dona destes lançamentos (o valor total por forma de pagamento,
        // a venda em dinheiro, a sangria): ela os recria do zero a cada nova conferência. Apagar um
        // deles por fora, sem reverter/conferir de novo, faz o valor desaparecer do financeiro sem
        // nenhum vestígio de por quê.
        if (transaction.cashier_session_id) {
            throw new Error('Este lançamento foi gerado pela conferência de caixa. Para corrigi-lo, reverta e refaça a conferência do caixa correspondente.')
        }

        await this.transactionsRepository.delete(id)
    }
}

