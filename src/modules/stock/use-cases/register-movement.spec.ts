import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryStocksRepository } from '@/modules/stock/repositories/in-memory/in-memory-stocks-repository'
import { RegisterStockMovementUseCase } from '@/modules/stock/use-cases/register-movement'
import { InMemoryItemsRepository } from '@/modules/items/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { ItemType } from '@/modules/items/use-cases/item'

let stocksRepository: InMemoryStocksRepository
let registerStockMovementUseCase: RegisterStockMovementUseCase
let itemsRepository: InMemoryItemsRepository

describe('Register Stock Movement Use Case', () => {
    beforeEach(() => {
        stocksRepository = new InMemoryStocksRepository()
        itemsRepository = new InMemoryItemsRepository()
        registerStockMovementUseCase = new RegisterStockMovementUseCase(stocksRepository, itemsRepository)
    })

    it('should be able to register an IN movement and update stock', async () => {
        const item = await itemsRepository.create({
            name: 'Produto Teste',
            type: 'PRODUCT',
            product: {
                create: {
                    display_id: 1,
                    price: 10,
                    stock: 0,
                    cost: 5
                }
            }
        } as any)

        const { new_balance, stock_movement } = await registerStockMovementUseCase.execute({
            item_id: item.id,
            quantity: 10,
            operation: 'IN',
            description: 'Compra'
        })

        expect(new_balance).toBe(10)
        expect(stock_movement.quantity).toBe(10)

        const updatedItem = await itemsRepository.findById(item.id)
        expect(updatedItem?.product?.stock).toBe(10)
    })

    it('should be able to register an OUT movement resulting in negative stock', async () => {
        const item = await itemsRepository.create({
            name: 'Produto Teste',
            type: 'PRODUCT',
            product: {
                create: {
                    display_id: 2,
                    price: 10,
                    stock: 5,
                    cost: 5
                }
            }
        } as any)

        const { new_balance } = await registerStockMovementUseCase.execute({
            item_id: item.id,
            quantity: 10,
            operation: 'OUT',
            description: 'Venda'
        })

        expect(new_balance).toBe(-5)

        const updatedItem = await itemsRepository.findById(item.id)
        expect(updatedItem?.product?.stock).toBe(-5)
    })

    it('should update cost when provided on IN operation', async () => {
        const item = await itemsRepository.create({
            name: 'Produto Custo',
            type: 'PRODUCT',
            product: {
                create: {
                    display_id: 3,
                    price: 10,
                    stock: 0,
                    cost: 5
                }
            }
        } as any)

        await registerStockMovementUseCase.execute({
            item_id: item.id,
            quantity: 5,
            operation: 'IN',
            unit_cost: 8
        })

        const updatedItem = await itemsRepository.findById(item.id)
        expect(updatedItem?.product?.cost).toBe(8)
    })

    it('should NOT update cost when NOT provided on IN operation', async () => {
        const item = await itemsRepository.create({
            name: 'Produto Sem Custo Novo',
            type: 'PRODUCT',
            product: {
                create: {
                    display_id: 4,
                    price: 10,
                    stock: 0,
                    cost: 5
                }
            }
        } as any)

        await registerStockMovementUseCase.execute({
            item_id: item.id,
            quantity: 5,
            operation: 'IN'
            // unit_cost undefined
        })

        const updatedItem = await itemsRepository.findById(item.id)
        expect(updatedItem?.product?.cost).toBe(5)
    })

    it('should NOT allow manual stock adjustment for composite products', async () => {
        const item = await itemsRepository.create({
            name: 'Produto Composto',
            type: 'PRODUCT',
            product: {
                create: {
                    display_id: 5,
                    price: 20,
                    stock: 0,
                    is_composite: true
                }
            }
        } as any)

        await expect(registerStockMovementUseCase.execute({
            item_id: item.id,
            quantity: 1,
            operation: 'IN'
        })).rejects.toThrow("Não é possível ajustar manualmente o estoque de produtos compostos.")
    })
})
