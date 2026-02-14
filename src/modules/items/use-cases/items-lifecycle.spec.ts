import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryProductsRepository } from '@/modules/items/repositories/in-memory/in-memory-products-repository'
import { InMemoryServicesRepository } from '@/modules/items/repositories/in-memory/in-memory-services-repository'
import { InMemorySuppliesRepository } from '@/modules/items/repositories/in-memory/in-memory-supplies-repository'
import { InMemoryItemsRepository } from '@/modules/items/repositories/in-memory/in-memory-items-repository'
import { InMemoryStocksRepository } from '@/modules/stock/repositories/in-memory/in-memory-stocks-repository'
import { CreateItemUseCase } from '@/modules/items/use-cases/item'
import { UpdateItemUseCase } from '@/modules/items/use-cases/update-item'
import { DeleteItemUseCase } from '@/modules/items/use-cases/delete-item'


// Use vi.hoisted to define the mock before imports are handled
const { txMock } = vi.hoisted(() => {
    return {
        txMock: {
            product: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
            service: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
            supply: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
            item: { delete: vi.fn().mockResolvedValue({}) },
            stock: { create: vi.fn().mockResolvedValue({}) }
        }
    }
})

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn().mockImplementation((callback) => callback(txMock)),
        product: { deleteMany: vi.fn() },
        service: { deleteMany: vi.fn() },
        supply: { deleteMany: vi.fn() },
        item: { delete: vi.fn() }
    }
}))

describe('Items Lifecycle', () => {
    let productsRepository: InMemoryProductsRepository
    let servicesRepository: InMemoryServicesRepository
    let suppliesRepository: InMemorySuppliesRepository
    let itemsRepository: InMemoryItemsRepository // Keep for generic checks if needed, but maybe not?
    let stocksRepository: InMemoryStocksRepository
    let createItemUseCase: CreateItemUseCase
    let updateItemUseCase: UpdateItemUseCase
    let deleteItemUseCase: DeleteItemUseCase

    beforeEach(() => {
        productsRepository = new InMemoryProductsRepository()
        servicesRepository = new InMemoryServicesRepository()
        suppliesRepository = new InMemorySuppliesRepository()
        itemsRepository = new InMemoryItemsRepository() // Note: This is separate from specific repos now.
        stocksRepository = new InMemoryStocksRepository()

        createItemUseCase = new CreateItemUseCase(productsRepository, servicesRepository, suppliesRepository, stocksRepository)
        updateItemUseCase = new UpdateItemUseCase(productsRepository, servicesRepository, suppliesRepository)
        deleteItemUseCase = new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)
        vi.clearAllMocks()
    })

    it('should create a product with minimal fields', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Produto Teste',
            price: 100,
            type: 'PRODUCT'
        })

        expect(item.id).toEqual(expect.any(String))
        expect(item.name).toEqual('Produto Teste')
        expect((item as any).price).toEqual(100)
    })

    it('should create a supply with minimal fields', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Teste',
            cost: 50,
            type: 'SUPPLY'
        })

        expect(item.id).toEqual(expect.any(String))
        expect(item.name).toEqual('Insumo Teste')
        expect((item as any).cost).toEqual(50)
    })

    it('should update supply cost while keeping the name in the parent table', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Original',
            cost: 10,
            type: 'SUPPLY'
        })

        const { item: updatedItem } = await updateItemUseCase.execute({
            id: item.id,
            cost: 20
        })

        expect(updatedItem.name).toEqual('Insumo Original')
        expect((updatedItem as any).cost).toEqual(20)
    })

    it('should verify permanent deletion of an item and its extensions', async () => {
        // 1. Create Insumo
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Para Deletar',
            cost: 30,
            type: 'SUPPLY'
        })

        const itemId = item.id

        // 2. Execute Deletion
        await deleteItemUseCase.execute({ itemId })

        // 3. Verify in repository (Specific)
        const found = await suppliesRepository.findById(itemId)
        expect(found).toBeNull()

        // 4. Verify extension is also null in the removed object (Mental check for InMemoryRepo consistency)
        // With separate repos, the item is just gone from the array.
        expect(suppliesRepository.items.find(i => i.id === itemId)).toBeUndefined()
    })

    it('should delete a service with display_id', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Serviço com ID',
            price: 50,
            type: 'SERVICE',
            display_id: 99
        })

        expect((item as any).display_id).toEqual(99)

        await deleteItemUseCase.execute({ itemId: item.id })

        const found = await servicesRepository.findById(item.id)
        expect(found).toBeNull()
    })
})
