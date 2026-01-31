import { ItemsRepository } from '@/repositories/items-repository'
import { StocksRepository } from '@/repositories/stocks-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

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

        // Manual Cascade within a Transaction to ensure permanence
        await prisma.$transaction(async (tx) => {
            // Delete specialized records first
            if (item.type === 'PRODUCT') {
                await tx.product.deleteMany({ where: { id: itemId } })
            } else if (item.type === 'SERVICE') {
                await tx.service.deleteMany({ where: { id: itemId } })
            } else if (item.type === 'SUPPLY') {
                await tx.supply.deleteMany({ where: { id: itemId } })
            }

            // Delete the parent Item record via repository to ensure state sync (InMemory)
            // and participation in the transaction (Prisma)
            await this.itemsRepository.remove(itemId, tx)
        })

        console.log(`[DeleteItem] Permanent removal successful for ID: ${itemId}`)
    }
}
