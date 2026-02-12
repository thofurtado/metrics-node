import { expect, describe, it, beforeEach } from 'vitest'
import { DeleteItemUseCase } from '@/modules/items/use-cases/delete-item'
import { InMemoryItemsRepository } from '@/modules/items/repositories/in-memory/in-memory-items-repository'
import { InMemoryStocksRepository } from '@/modules/stock/repositories/in-memory/in-memory-stocks-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

let itemsRepository: InMemoryItemsRepository
let stocksRepository: InMemoryStocksRepository
let sut: DeleteItemUseCase

describe('Delete Item Use Case', () => {
    beforeEach(() => {
        itemsRepository = new InMemoryItemsRepository()
        stocksRepository = new InMemoryStocksRepository()
        sut = new DeleteItemUseCase(itemsRepository, stocksRepository)
    })

    it('should be able to delete an item without stock history', async () => {
        const item = await itemsRepository.create({
            name: 'Mouse',
            cost: 10,
            price: 20,
            stock: 0
        })

        await sut.execute({ itemId: item.id })

        const deletedItem = await itemsRepository.findById(item.id)
        expect(deletedItem).toBeNull()
    })

    it('should not be able to delete an item with stock history', async () => {
        // Create Item
        const item = await itemsRepository.create({
            name: 'Teclado',
            cost: 50,
            price: 100,
            stock: 0
        })

        // Add Stock History (Movement)
        await stocksRepository.create({
            item_id: item.id,
            quantity: 5,
            operation: 'input',
            created_at: new Date()
        })

        // Try Delete
        await expect(sut.execute({ itemId: item.id }))
            .rejects.toThrow('Cannot delete item with stock history. Archive it instead.')
    })

    it('should not be able to delete a non-existent item', async () => {
        await expect(sut.execute({ itemId: 'non-existent-id' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
