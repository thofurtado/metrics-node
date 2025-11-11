import { TransactionsRepository } from '@/repositories/transactions-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error' // Importa o erro

interface ChangeTransactionUseCaseRequest {
    id: string
}

export class ChangeTransactionUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }

    async execute({
        id,
    }: ChangeTransactionUseCaseRequest): Promise<void> {

        // 1. O repositório agora faz a busca e lança o erro se não encontrar.
        try {
            console.log("Use Case: Iniciando Troca")
            await this.transactionsRepository.changeTransactionStatus(id)
        } catch (error) {
            // Se o repositório lançar ResourceNotFoundError (ou qualquer outro erro),
            // ele será propagado. Se você lançou ResourceNotFoundError, você pode 
            // tratá-lo aqui (opcionalmente) ou no Controller (como você já está fazendo).

            // Se for um erro de recurso não encontrado, relance ele
            if (error instanceof ResourceNotFoundError) {
                throw new Error('Transaction not found') // Use a mensagem que seu Controller espera
            }
            throw error
        }
    }
}