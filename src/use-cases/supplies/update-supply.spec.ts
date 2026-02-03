
import { InMemorySuppliesRepository } from '@/repositories/in-memory/in-memory-supplies-repository'
import { InMemoryProductsRepository } from '@/repositories/in-memory/in-memory-products-repository'
import { UpdateSupplyUseCase } from './update-supply'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock prisma to bypass the transaction call which isn't supported by InMemory repos directly
vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn(async (callback) => callback('mock-tx'))
    }
}))

let suppliesRepository: InMemorySuppliesRepository
let productsRepository: InMemoryProductsRepository
let sut: UpdateSupplyUseCase

describe('Update Supply Use Case (Cascade)', () => {
    beforeEach(() => {
        suppliesRepository = new InMemorySuppliesRepository()
        productsRepository = new InMemoryProductsRepository()
        sut = new UpdateSupplyUseCase(suppliesRepository, productsRepository)
    })

    it('should cascade update product cost when supply cost changes', async () => {
        // 1. Cadastre um Insumo 'Pão' com custo 1.00.
        const supply = await suppliesRepository.create({
            name: 'Pão',
            cost: 1.00,
            stock: 100
        })

        // 2. Cadastre um Produto 'Sanduíche' composto por 2 'Pães' (Custo esperado: 2.00).
        // Initial cost is manually set here to match expectation, though pure UseCase logic would calculate it.
        // We simulate the stored state.
        const product = await productsRepository.create({
            name: 'Sanduíche',
            price: 10.00,
            cost: 2.00,
            is_composite: true,
            compositions: {
                create: [
                    {
                        supply: { connect: { id: supply.id } },
                        quantity: 2
                    }
                ]
            }
        })

        // Verify initial state
        expect(product.cost).toBe(2.00)

        // 3. Altere o custo do Insumo 'Pão' para 2.00.
        // This execution triggers the cascade logic in the UseCase
        await sut.execute({
            id: supply.id,
            cost: 2.00
        })

        // 4. Verifique se, sem intervenção manual, o custo do 'Sanduíche' no banco de dados passou a ser 4.00.
        const updatedProduct = await productsRepository.findById(product.id)

        expect(updatedProduct).toBeDefined()
        expect(updatedProduct!.cost).toBe(4.00) // 2 quantity * 2.00 cost
    })
})
