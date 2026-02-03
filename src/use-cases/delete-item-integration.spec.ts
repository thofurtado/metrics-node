import { expect, describe, it, beforeAll } from 'vitest'
import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { DeleteItemUseCase } from './delete-item'
import { prisma } from '@/lib/prisma'

describe('Delete Item Integration (DB Persistence)', () => {
    let productsRepository: PrismaProductsRepository
    let servicesRepository: PrismaServicesRepository
    let suppliesRepository: PrismaSuppliesRepository
    let sut: DeleteItemUseCase

    beforeAll(() => {
        productsRepository = new PrismaProductsRepository()
        servicesRepository = new PrismaServicesRepository()
        suppliesRepository = new PrismaSuppliesRepository()
        sut = new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)
    })

    it('should create a Product and then delete it permanently from the database', async () => {
        // 1. Create Product
        const displayId = Math.floor(Math.random() * 1000000)
        const product = await productsRepository.create({
            name: `Integration Test Product ${Date.now()}`,
            price: 100.00,
            display_id: displayId,
            stock: 10,
            active: true
        })

        // 2. Verify existence
        const persistedProduct = await prisma.product.findUnique({
            where: { id: product.id }
        })
        expect(persistedProduct).toBeTruthy()
        expect(persistedProduct?.id).toBe(product.id)

        // 3. Execute Delete Use Case
        await sut.execute({ itemId: product.id })

        // 4. Verify deletion from DB
        const deletedProduct = await prisma.product.findUnique({
            where: { id: product.id }
        })
        expect(deletedProduct).toBeNull()
    })

    it('should create a Service and then delete it permanently from the database', async () => {
        // 1. Create Service
        const displayId = Math.floor(Math.random() * 1000000)
        const service = await servicesRepository.create({
            name: `Integration Test Service ${Date.now()}`,
            price: 50.00,
            display_id: displayId,
            estimated_time: '30m'
        })

        // 2. Verify existence
        const persistedService = await prisma.service.findUnique({ where: { id: service.id } })
        expect(persistedService).toBeTruthy()

        // 3. Execute Delete Use Case
        await sut.execute({ itemId: service.id })

        // 4. Verify deletion from DB
        const deletedService = await prisma.service.findUnique({ where: { id: service.id } })
        expect(deletedService).toBeNull()
    })

    it('should create a Supply and then delete it permanently from the database', async () => {
        // 1. Create Supply
        const supply = await suppliesRepository.create({
            name: `Integration Test Supply ${Date.now()}`,
            cost: 10.00,
            stock: 100,
            unit: 'kg'
        })

        // 2. Verify existence
        const persistedSupply = await prisma.supply.findUnique({ where: { id: supply.id } })
        expect(persistedSupply).toBeTruthy()

        // 3. Execute Delete Use Case
        await sut.execute({ itemId: supply.id })

        // 4. Verify deletion from DB
        const deletedSupply = await prisma.supply.findUnique({ where: { id: supply.id } })
        expect(deletedSupply).toBeNull()
    })
})
