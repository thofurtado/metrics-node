import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { GetStocksByItemUseCase } from './get-stock-by-item'



let stocksRepository: InMemoryStocksRepository
let getStocksUseCase: GetStocksByItemUseCase
let itemsRepository: InMemoryItemsRepository

describe('Get Stocks By Item Use Case', () => {
    beforeEach(() => {
        stocksRepository = new InMemoryStocksRepository()
        itemsRepository = new InMemoryItemsRepository
        getStocksUseCase = new GetStocksByItemUseCase(stocksRepository)
    })
    it('should be able to get stocks by item', async () => {
        const item = await itemsRepository.create({
            name: 'teste1',
            price: 1,
            cost: 0.5,
            stock: 0
        })
        await stocksRepository.create({
            item_id: item.id,
            quantity: 4,
            operation: 'input',
        })
        await stocksRepository.create({
            item_id: item.id,
            quantity: 5,
            operation: 'output',
        })
        await stocksRepository.create({
            item_id: item.id,
            quantity: 4,
            operation: 'input',
        })

        await stocksRepository.create({
            item_id: item.id,
            quantity: 2,
            operation: 'output',
        })
        const { stocks } = await getStocksUseCase.execute({ item_id: item.id })
        const input = stocks?.filter(item => item.operation === 'input')
        const output = stocks?.filter(item => item.operation === 'output')
        const totalInput = input?.reduce((total, item) => total + item.quantity, 0)
        const totalOutput = output?.reduce((total, item) => total + item.quantity, 0)
        if(totalInput !== undefined && totalOutput !== undefined)
            expect(totalInput-totalOutput).toEqual(1)
        expect(stocks?.length).toEqual(4)
    })

})
