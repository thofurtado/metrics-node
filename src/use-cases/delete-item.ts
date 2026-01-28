import { ItemsRepository } from '@/repositories/items-repository'
import { StocksRepository } from '@/repositories/stocks-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface DeleteItemUseCaseRequest {
    itemId: string
}

export class DeleteItemUseCase {
    constructor(
        private itemsRepository: ItemsRepository,
        private stocksRepository: StocksRepository
    ) { }

    async execute({ itemId }: DeleteItemUseCaseRequest): Promise<void> {
        const item = await this.itemsRepository.findById(itemId)

        if (!item) {
            throw new ResourceNotFoundError()
        }

        // Check for active stock or history
        const stockHistory = await this.stocksRepository.getItemHistory(itemId)

        // If there's any stock history (movements), preventing deletion ensures data integrity check
        // Assuming getItemHistory returns null or empty array if no history
        if (stockHistory && stockHistory.length > 0) {
            throw new Error('Cannot delete item with stock history. Archive it instead.')
        }

        await this.itemsRepository.remove(itemId)
    }
}
