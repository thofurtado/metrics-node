import { expect, describe, it, beforeAll } from 'vitest'
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { prisma } from '@/lib/prisma'
import { ItemType } from '@/modules/items/use-cases/item'

describe('PrismaItemsRepository Cascade Delete', () => {
    let sut: PrismaItemsRepository

    beforeAll(() => {
        sut = new PrismaItemsRepository()
    })

    it('should delete Product when Item is deleted (Cascade)', async () => {
        // 1. Create a Product Item
        // We use a random display_id to reduce collision chance in test environment
        const displayId = Math.floor(Math.random() * 1000000) + 100000

        const item = await sut.create({
            name: `Test Cascade Product ${Date.now()}`,
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: displayId,
                    price: 150.00,
                    stock: 10,
                    min_stock: 2,
                    barcode: '123456789'
                }
            }
        })

        // 2. Verify Product exists in DB directly
        const product = await prisma.product.findUnique({
            where: { id: item.id }
        })
        expect(product).toBeTruthy()
        expect(product?.id).toBe(item.id)

        // 3. Delete the Item (Parent)
        await sut.remove(item.id)

        // 4. Verify Parent is gone
        const deletedItem = await (prisma as any).product.findUnique({
            where: { id: item.id }
        })
        expect(deletedItem).toBeNull()

        // 5. Verify Product is gone (Child - Cascade)
        const deletedProduct = await prisma.product.findUnique({
            where: { id: item.id }
        })
        expect(deletedProduct).toBeNull()
    })

    it('should delete Service when Item is deleted (Cascade)', async () => {
        const displayId = Math.floor(Math.random() * 1000000) + 200000

        const item = await sut.create({
            name: `Test Cascade Service ${Date.now()}`,
            type: ItemType.SERVICE,
            service: {
                create: {
                    display_id: displayId,
                    price: 80.00,
                    estimated_time: '1h'
                }
            }
        })

        const service = await prisma.service.findUnique({
            where: { id: item.id }
        })
        expect(service).toBeTruthy()

        await sut.remove(item.id)

        const deletedService = await prisma.service.findUnique({
            where: { id: item.id }
        })
        expect(deletedService).toBeNull()
    })

    it('should delete Supply when Item is deleted (Cascade)', async () => {
        const item = await sut.create({
            name: `Test Cascade Supply ${Date.now()}`,
            type: ItemType.SUPPLY,
            supply: {
                create: {
                    cost: 50.00,
                    stock: 100,
                    unit: 'UN'
                }
            }
        })

        const supply = await prisma.supply.findUnique({
            where: { id: item.id }
        })
        expect(supply).toBeTruthy()

        await sut.remove(item.id)

        const deletedSupply = await prisma.supply.findUnique({
            where: { id: item.id }
        })
        expect(deletedSupply).toBeNull()
    })
})
