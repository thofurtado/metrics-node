import { InMemoryProductsRepository } from '@/modules/products/repositories/in-memory/in-memory-products-repository'
import { InMemorySuppliesRepository } from '@/repositories/in-memory/in-memory-supplies-repository'
import { DecreaseStockUseCase } from '@/modules/stock/use-cases/decrease-stock'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mocking Prisma Transaction
// Since the use case imports 'prisma' directly, we can't easily mock it via dependency injection in the constructor
// unless we refactor the usecase.
// However, for this unit test using InMemory repositories, the `prisma.$transaction` call 
// will fail if we are running in an environment without a real database connection OR
// if we don't mock the module.
// 
// Fortunately, Vitest allows mocking modules. 
// We will mock '@/lib/prisma' to just execute the callback.
vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (callback: any) => callback(null) // Mock transaction passing null as tx
    }
}))

let productsRepository: InMemoryProductsRepository
let suppliesRepository: InMemorySuppliesRepository
let sut: DecreaseStockUseCase

describe('Decrease Stock Use Case', () => {
    beforeEach(() => {
        productsRepository = new InMemoryProductsRepository()
        suppliesRepository = new InMemorySuppliesRepository()
        sut = new DecreaseStockUseCase(productsRepository, suppliesRepository)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should decrease stock for a simple product', async () => {
        const product = await productsRepository.create({
            name: 'Coca Cola',
            price: 5.0,
            stock: 10,
        })

        await sut.execute({ productId: product.id, quantity: 2 })

        const updatedProduct = await productsRepository.findById(product.id)
        expect(updatedProduct?.stock).toBe(8)
    })

    it('should decrease stock for a composite product (Hamburger)', async () => {
        // 1. Create Supplies
        const meat = await suppliesRepository.create({
            name: 'Carne',
            cost: 10.0,
            stock: 1000,
            unit: 'g'
        })

        const bread = await suppliesRepository.create({
            name: 'Pão',
            cost: 2.0,
            stock: 50,
            unit: 'un'
        })

        // 2. Create Composite Product (Hamburger)
        // We use create with compositions. 
        // InMemoryProductsRepository expects nested CreateInput structure we mocked.
        const hamburger = await productsRepository.create({
            name: 'Hambúrguer',
            price: 25.0,
            is_composite: true,
            compositions: {
                create: [
                    {
                        quantity: 200, // 200g of meat
                        supply: { connect: { id: meat.id } }
                    },
                    {
                        quantity: 1, // 1 bread
                        supply: { connect: { id: bread.id } }
                    }
                ]
            }
        } as any)

        // 3. Execute Sale of 1 Hamburger
        await sut.execute({ productId: hamburger.id, quantity: 1 })

        // 4. Validate Final Stocks
        // Hamburger stock should NOT change (it's 0 usually, or explicitly tracked? 
        // In this logic, we only touch supplies for composite items).
        // Let's check Supplies.

        const updatedMeat = await suppliesRepository.findById(meat.id)
        const updatedBread = await suppliesRepository.findById(bread.id)

        // Meat: 1000 - (1 * 200) = 800
        expect(updatedMeat?.stock).toBe(800)

        // Bread: 50 - (1 * 1) = 49
        expect(updatedBread?.stock).toBe(49)
    })
})
