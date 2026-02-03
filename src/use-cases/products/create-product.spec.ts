import { InMemoryProductsRepository } from '@/repositories/in-memory/in-memory-products-repository'
import { InMemorySuppliesRepository } from '@/repositories/in-memory/in-memory-supplies-repository'
import { CreateProductUseCase } from './create-product'
import { describe, it, expect, beforeEach } from 'vitest'

let productsRepository: InMemoryProductsRepository
let suppliesRepository: InMemorySuppliesRepository
let sut: CreateProductUseCase

describe('Create Product Use Case', () => {
    beforeEach(() => {
        productsRepository = new InMemoryProductsRepository()
        suppliesRepository = new InMemorySuppliesRepository()
        sut = new CreateProductUseCase(productsRepository, suppliesRepository)
    })

    it('should be able to create a new product', async () => {
        const { product } = await sut.execute({
            name: 'Coca Cola',
            price: 5.0,
            stock: 10,
            category: 'Bebidas'
        })

        expect(product.id).toEqual(expect.any(String))
        expect(productsRepository.items).toHaveLength(1)
        expect(productsRepository.items[0].name).toEqual('Coca Cola')
    })

    it('should be able to create a composite product', async () => {
        const supplyId = 'some-supply-id'

        const { product } = await sut.execute({
            name: 'Combo',
            price: 20.0,
            is_composite: true,
            compositions: [
                { supply_id: supplyId, quantity: 2 }
            ]
        })

        expect(product.is_composite).toBe(true)
        expect(productsRepository.compositions).toHaveLength(1)
        expect(productsRepository.compositions[0]).toMatchObject({
            product_id: product.id,
            supply_id: supplyId,
            quantity: 2
        })
    })
})
