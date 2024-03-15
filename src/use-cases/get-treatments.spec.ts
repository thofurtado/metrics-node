import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { GetTreatmentsUseCase } from './get-treatments'



let treatmentsRepository: InMemoryTreatmentsRepository
let getTreatmentsUseCase: GetTreatmentsUseCase


describe('Get Treatments Use Case', () => {
    beforeEach(() => {
        treatmentsRepository = new InMemoryTreatmentsRepository()
        getTreatmentsUseCase = new GetTreatmentsUseCase(treatmentsRepository)
    })
    it('should be able to get treatments', async () => {

        await treatmentsRepository.create({
            request: 'solicitação 1'
        })
        await treatmentsRepository.create({
            request: 'solicitação 2'
        })
        await treatmentsRepository.create({
            request: 'solicitação 3',
            finished: true
        })
        await treatmentsRepository.create({
            request: 'solicitação 4',
            finished: true
        })
        await treatmentsRepository.create({
            request: 'solicitação 5',
            finished: false
        })
        const  treatments  = await getTreatmentsUseCase.execute()

        expect(treatments.treatments?.length).toEqual(3)
    })

})
