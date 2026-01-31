import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { StockUseCase } from './stock'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { InvalidOptionError } from './errors/invalid-option-error'
import { StockCannotBeNegativaError } from './errors/stock-cannot-be-negative-error'
import { ItemType } from '@prisma/client'

let stocksRepository: InMemoryStocksRepository
let stockUseCase: StockUseCase
let itemsRepository: InMemoryItemsRepository

describe('Stock Use Case', () => {
    beforeEach(() => {
        stocksRepository = new InMemoryStocksRepository()
        itemsRepository = new InMemoryItemsRepository()
        stockUseCase = new StockUseCase(stocksRepository, itemsRepository)
    })

    it('should be able to create a stock', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: 1,
                    price: 2,
                    stock: 0
                }
            }
        } as any)

        const { stock } = await stockUseCase.execute({
            item_id: item.id,
            quantity: 5,
            operation: 'IN'
        })

        expect(stock.id).toEqual(expect.any(String))
    })

    it('should be able to create a output stock', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: 2,
                    price: 2,
                    stock: 4
                }
            }
        } as any)

        await stocksRepository.create({
            item_id: item.id,
            quantity: 4,
            operation: 'IN' // Changed to IN
        } as any)

        const { stock } = await stockUseCase.execute({
            item_id: item.id,
            quantity: 1,
            operation: 'OUT'
        })

        expect(stock.id).toEqual(expect.any(String))
    })

    it('should not be able to create a stock with inexistent item', async () => {
        await expect(stockUseCase.execute({
            item_id: 'non-existent-id',
            quantity: 5,
            operation: 'IN'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

    it('should not be able to create a stock with non natural numbers', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: 3,
                    price: 2,
                    stock: 0
                }
            }
        } as any)

        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 0,
            operation: 'IN'
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })

    it('should not be able to create a stock with wrong option', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: 4,
                    price: 2,
                    stock: 0
                }
            }
        } as any)

        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 2,
            operation: 'exchange'
        })).rejects.toBeInstanceOf(InvalidOptionError)
    })

    it('should not be able to create an output stock greater then the item stock', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            type: ItemType.PRODUCT,
            product: {
                create: {
                    display_id: 5,
                    price: 2,
                    stock: 5
                }
            }
        } as any)

        // Seed stock balance in repo simulation (logs usually)
        await stocksRepository.create({
            item_id: item.id,
            quantity: 5,
            operation: 'IN'
        } as any)

        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 6,
            operation: 'OUT'
        })).rejects.toBeInstanceOf(StockCannotBeNegativaError)
    })

    it('should not be able to create stock for a Service', async () => {
        const item = await itemsRepository.create({
            name: 'serviço',
            type: ItemType.SERVICE,
            service: {
                create: {
                    display_id: 6,
                    price: 100,
                    estimated_time: '1h'
                }
            }
        } as any)

        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 1,
            operation: 'IN'
        })).rejects.toThrow('Serviços não possuem controle de estoque.')
    })
})
