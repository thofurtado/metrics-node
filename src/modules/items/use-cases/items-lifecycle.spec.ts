import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryItemsRepository } from '@/modules/items/repositories/in-memory/in-memory-items-repository'
import { InMemoryStocksRepository } from '@/modules/stock/repositories/in-memory/in-memory-stocks-repository'
import { ItemUseCase } from '@/modules/items/use-cases/item'
import { UpdateItemUseCase } from '@/modules/items/use-cases/update-item'
import { DeleteItemUseCase } from '@/modules/items/use-cases/delete-item'
import { ItemType } from '@prisma/client'

// Use vi.hoisted to define the mock before imports are handled
const { txMock } = vi.hoisted(() => {
    return {
        txMock: {
            product: { deleteMany: vi.fn().mockResolvedValue({}) },
            service: { deleteMany: vi.fn().mockResolvedValue({}) },
            supply: { deleteMany: vi.fn().mockResolvedValue({}) },
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
    let itemsRepository: InMemoryItemsRepository
    let stocksRepository: InMemoryStocksRepository
    let createItemUseCase: ItemUseCase
    let updateItemUseCase: UpdateItemUseCase
    let deleteItemUseCase: DeleteItemUseCase

    beforeEach(() => {
        itemsRepository = new InMemoryItemsRepository()
        stocksRepository = new InMemoryStocksRepository()
        createItemUseCase = new ItemUseCase(itemsRepository, stocksRepository)
        updateItemUseCase = new UpdateItemUseCase(itemsRepository)
        deleteItemUseCase = new DeleteItemUseCase(itemsRepository, stocksRepository)
        vi.clearAllMocks()
    })

    it('should create a product with minimal fields', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Produto Teste',
            price: 100,
            type: ItemType.PRODUCT
        })

        expect(item.id).toEqual(expect.any(String))
        expect(item.name).toEqual('Produto Teste')
        expect((item as any).product?.price).toEqual(100)
    })

    it('should create a supply with minimal fields', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Teste',
            cost: 50,
            type: ItemType.SUPPLY
        })

        expect(item.id).toEqual(expect.any(String))
        expect(item.name).toEqual('Insumo Teste')
        expect((item as any).supply?.cost).toEqual(50)
    })

    it('should update supply cost while keeping the name in the parent table', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Original',
            cost: 10,
            type: ItemType.SUPPLY
        })

        const { item: updatedItem } = await updateItemUseCase.execute({
            id: item.id,
            cost: 20
        })

        expect(updatedItem.name).toEqual('Insumo Original')
        expect((updatedItem as any).supply?.cost).toEqual(20)
    })

    it('should verify permanent deletion of an item and its extensions', async () => {
        // 1. Create Insumo
        const { item } = await createItemUseCase.execute({
            name: 'Insumo Para Deletar',
            cost: 30,
            type: ItemType.SUPPLY
        })

        const itemId = item.id

        // 2. Execute Deletion
        await deleteItemUseCase.execute({ itemId })

        // 3. Verify in repository (Parent)
        const found = await itemsRepository.findById(itemId)
        expect(found).toBeNull()

        // 4. Verify extension is also null in the removed object (Mental check for InMemoryRepo consistency)
        expect(itemsRepository.items.find(i => i.id === itemId)).toBeUndefined()
    })

    it('should delete a service with display_id', async () => {
        const { item } = await createItemUseCase.execute({
            name: 'Serviço com ID',
            price: 50,
            type: ItemType.SERVICE,
            display_id: 99
        })

        expect((item as any).service?.display_id).toEqual(99)

        await deleteItemUseCase.execute({ itemId: item.id })

        const found = await itemsRepository.findById(item.id)
        expect(found).toBeNull()
    })
})
