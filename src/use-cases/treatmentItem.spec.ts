import { expect, describe, it, beforeEach } from 'vitest'
import { TreatmentItemUseCase } from './treatmentItem'
import { InMemoryTreatmentItemsRepository } from '@/repositories/in-memory/in-memory-treatmentItems-repository'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'



let treatmentItemsRepository: InMemoryTreatmentItemsRepository
let itemsRepository: InMemoryItemsRepository
let treatmentsRepository: InMemoryTreatmentsRepository
let stocksRepository: InMemoryStocksRepository
let treatmentItemUseCase: TreatmentItemUseCase


describe('TreatmentItem Use Case', () => {
    beforeEach(() => {
        treatmentsRepository = new InMemoryTreatmentsRepository()
        treatmentItemsRepository = new InMemoryTreatmentItemsRepository()
        itemsRepository = new InMemoryItemsRepository()
        stocksRepository = new InMemoryStocksRepository()
        treatmentItemUseCase = new TreatmentItemUseCase(treatmentItemsRepository,treatmentsRepository, itemsRepository, stocksRepository)
    })
    it('should be able to create treatmentItem', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })
        const { treatmentItem } = await treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 5,
            salesValue: 10
        })

        expect(treatmentItem.id).toEqual(expect.any(String))

    })
    it('should not be able to create a treatmentItem with an invalid treatment', async () => {
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })

        await expect(treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: 'treatment.id',
            quantity: 5,
            salesValue: 10
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a treatmentItem with an invalid item', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })

        await expect(treatmentItemUseCase.execute({
            item_id: 'item.id',
            treatment_id: treatment.id,
            quantity: 5,
            salesValue: 10
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a treatmentItem with an invalid stock', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })
        await expect(treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            stock_id: 'stock.id',
            quantity: 5,
            salesValue: 10
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a treatmentItem with an invalid stock', async () => {

        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })
        const stock = await stocksRepository.create({
            item_id: item.id,
            quantity: 2,
            operation: 'output',
            description: 'venda'
        })
        const treatmentItem = await treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            stock_id: stock.id,
            quantity: 5,
            salesValue: 10
        })
        expect(treatmentItem.treatmentItem.id).toEqual(expect.any(String))
    })
    it('should not be able to create a treatmentItem with a quantity less or iqual to 0', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })
        await expect(treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 0,
            salesValue: 10
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create a treatmentItem with a salesValue less or iqual to 0', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste de titulo',
            contact: 'Usuário'
        })
        const item = await itemsRepository.create({
            name: 'produto teste',
            cost: 1,
            price:2,
            stock:0
        })
        await expect(treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 2,
            salesValue: 0
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })

})
