import { describe, it, beforeEach, expect } from 'vitest'
import { InMemoryTreatmentItemsRepository } from '@/repositories/in-memory/in-memory-treatmentItems-repository'
import { RemoveTreatmentItemUseCase } from './remove-treatment-item'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'





let treatmentItemsRepository: InMemoryTreatmentItemsRepository
let removeTreatmentItemUseCase: RemoveTreatmentItemUseCase
let treatmentsRepository: InMemoryTreatmentsRepository
let itemsRepository: InMemoryItemsRepository
describe('Remove Treatment Item Use Case', () => {
    beforeEach(() => {

        treatmentItemsRepository = new InMemoryTreatmentItemsRepository()
        treatmentsRepository = new InMemoryTreatmentsRepository()
        itemsRepository = new InMemoryItemsRepository
        removeTreatmentItemUseCase = new RemoveTreatmentItemUseCase(treatmentItemsRepository, treatmentsRepository)
    })
    it('should be able to remove a treatmentItem', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'test'
        })
        const item = await itemsRepository.create({
            name: 'Mouse Usb 2.0 Multilaser',
            description: 'Mouse simples',
            cost: 9.5,
            price: 17.3,
            stock: 5
        })
        const treatmentItem = await treatmentItemsRepository.create({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 10,
            salesValue: 20
        })
        await removeTreatmentItemUseCase.execute({
            id: treatmentItem.id
        })
        const teste = await treatmentItemsRepository.findById(treatmentItem.id)

        expect(teste).toBeNull()

    })
    it('should be able to remove a treatmentItem with a treatment with salesvalue null', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'test'
        })
        const item = await itemsRepository.create({
            name: 'Mouse Usb 2.0 Multilaser',
            description: 'Mouse simples',
            cost: 9.5,
            price: 17.3,
            stock: 5
        })
        const treatmentItem = await treatmentItemsRepository.create({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 10,
            salesValue: null
        })
        await removeTreatmentItemUseCase.execute({
            id: treatmentItem.id
        })
        const teste = await treatmentItemsRepository.findById(treatmentItem.id)

        expect(teste).toBeNull()

    })
    it('should not be able to create a treatmentItem with a invalid id', async () => {

        await expect(removeTreatmentItemUseCase.execute({
            id: 'false_id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
