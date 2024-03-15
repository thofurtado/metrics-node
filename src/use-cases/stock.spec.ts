import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { StockUseCase } from './stock'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { InvalidOptionError } from './errors/invalid-option-error'




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
            cost: 1,
            price: 2,
            stock: 0
        })
        const { stock } = await stockUseCase.execute({
            item_id: item.id,
            quantity: 5,
            operation: 'input'
        })

        expect(stock.id).toEqual(expect.any(String))
    })
    it('should not be able to create a stock with inexistent item', async () => {

        await expect(stockUseCase.execute({
            item_id: 'item.id',
            quantity: 5,
            operation: 'input'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a stock with non natural numbers', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            cost: 1,
            price: 2,
            stock: 0
        })
        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 0,
            operation: 'input'
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create a stock with non natural numbers', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            cost: 1,
            price: 2,
            stock: 0
        })
        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 0,
            operation: 'input'
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create a stock with wrong option', async () => {
        const item = await itemsRepository.create({
            name: 'produto',
            cost: 1,
            price: 2,
            stock: 0
        })
        await expect(stockUseCase.execute({
            item_id: item.id,
            quantity: 2,
            operation: 'exchange'
        })).rejects.toBeInstanceOf(InvalidOptionError)
    })

})
