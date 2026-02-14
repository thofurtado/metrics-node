import { expect, describe, it, beforeEach } from 'vitest'
import { DeleteItemUseCase } from '@/modules/items/use-cases/delete-item'
import { InMemoryProductsRepository } from '@/modules/items/repositories/in-memory/in-memory-products-repository'
import { InMemoryServicesRepository } from '@/modules/items/repositories/in-memory/in-memory-services-repository'
import { InMemorySuppliesRepository } from '@/modules/items/repositories/in-memory/in-memory-supplies-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

let productsRepository: InMemoryProductsRepository
let servicesRepository: InMemoryServicesRepository
let suppliesRepository: InMemorySuppliesRepository
let sut: DeleteItemUseCase

describe('Delete Item Use Case', () => {
    beforeEach(() => {
        productsRepository = new InMemoryProductsRepository()
        servicesRepository = new InMemoryServicesRepository()
        suppliesRepository = new InMemorySuppliesRepository()
        sut = new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)
    })

    it('should be able to delete an item (Product)', async () => {
        const item = await productsRepository.create({
            name: 'Mouse',
            price: 20,
            stock: 0,
            display_id: 1
        })

        await sut.execute({ itemId: item.id })

        const deletedItem = await productsRepository.findById(item.id)
        expect(deletedItem).toBeNull()
    })

    /*
    it('should not be able to delete an item with stock history', async () => {
        // This test logic relies on Database Constraints (Foreign Keys) which are not present in InMemory repositories.
        // The CreateItemUseCase or Repositories would need to explicitely check for stock history and throw,
        // but currently it seems to rely on Prisma throwing P2003 or similar, which DeleteItemUseCase catches to do Soft Delete.
        // In InMemory environment, we don't simulate this constraint yet.
    })
    */

    it('should not be able to delete a non-existent item', async () => {
        await expect(sut.execute({ itemId: 'non-existent-id' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
