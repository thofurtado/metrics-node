import { expect, describe, it, beforeEach } from 'vitest'
import { ItemUseCase } from './item'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { PriceCannotBeLowerThanCost } from './errors/price-cannot-be-lower-than-cost-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'



let itemsRepository: InMemoryItemsRepository
let stocksRepository: InMemoryStocksRepository

let itemUseCase: ItemUseCase

describe('Item Use Case', () => {
    beforeEach(() => {
        itemsRepository = new InMemoryItemsRepository()
        stocksRepository = new InMemoryStocksRepository()
        itemUseCase = new ItemUseCase(itemsRepository, stocksRepository)
    })
    it('should be able to create an item', async () => {

        const { item } = await itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            description: 'Mouse simples',
            cost: 9.5,
            price: 17.3,
        })

        expect(item.id).toEqual(expect.any(String))
    })
    it('should be able to create an item with stock value', async () => {

        const { item } = await itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            description: 'Mouse simples',
            cost: 9.5,
            price: 17.3,
            stock: 5
        })
        const stock = stocksRepository.items.slice()
        expect(item.id).toEqual(expect.any(String))
        expect(stock.length).toEqual(1)
    })
    it('should not be able to create an item with the same name', async () => {
        await itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: 9.5,
            price: 17.3,
            stock: 2
        })
        await expect(itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: 9.5,
            price: 17.3,
            stock: 2
        })).rejects.toBeInstanceOf(ThisNameAlreadyExistsError)
    })
    it('should not be able to create an item with the cost gratter than the price', async () => {

        await expect(itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: 9.5,
            price: 2,
        })).rejects.toBeInstanceOf(PriceCannotBeLowerThanCost)
    })
    it('should not be able to create an item with a negative cost', async () => {

        await expect(itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: -1,
            price: 2,
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create an item with a negative price', async () => {

        await expect(itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: -2,
            price: -1,
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create an item with a negative stock', async () => {

        await expect(itemUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            cost: 2,
            price: 3,
            stock: -1
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
})

