import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { GetItemsUseCase } from './get-items'



let itemsRepository: InMemoryItemsRepository
let getItemsUseCase: GetItemsUseCase


describe('Get Items Use Case', () => {
    beforeEach(() => {
        itemsRepository = new InMemoryItemsRepository()
        getItemsUseCase = new GetItemsUseCase(itemsRepository)
    })
    it('should be able to get items', async () => {

        await itemsRepository.create({
            name: 'teste',
            cost: 1,
            price:2,
            stock: 0
        })
        await itemsRepository.create({
            name: 'teste2',
            cost: 1,
            price:2,
            stock: 0
        })
        await itemsRepository.create({
            name: 'teste1',
            cost: 1,
            price:2,
            stock: 0
        })

        const  items  = await getItemsUseCase.execute()

        expect(items.items?.length).toEqual(3)
    })

})
