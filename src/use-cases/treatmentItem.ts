import { TreatmentItemsRepository } from '@/repositories/treatmentItems-repository'
import { TreatmentItem } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { StocksRepository } from '@/repositories/stocks-repository'
import { ItemsRepository } from '@/repositories/items-repository'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { TreatmentsRepository } from '@/repositories/treatments-repository'

interface TreatmentItemUseCaseRequest {
    item_id: string
    treatment_id: string
    stock_id?: string
    quantity: number
    salesValue: number
}
interface TreatmentItemUseCaseResponse {
    treatmentItem: TreatmentItem
}
export class TreatmentItemUseCase {

    constructor(
        private treatmentItemsRepository: TreatmentItemsRepository,
        private treatmentsRepository: TreatmentsRepository,
        private itemsRepository: ItemsRepository,
        private stocksRepository: StocksRepository
    ) { }
    async execute({
        item_id, treatment_id, stock_id, quantity, salesValue
    }: TreatmentItemUseCaseRequest): Promise<TreatmentItemUseCaseResponse> {
        let item
        if (item_id) {
            item = await this.itemsRepository.findById(item_id)
            if (!item)
                throw new ResourceNotFoundError()
        }
        let treatment
        if (treatment_id) {
            treatment = await this.treatmentsRepository.findById(treatment_id)
            if (!treatment)
                throw new ResourceNotFoundError()
        }
        let stock
        if (stock_id) {
            stock = await this.stocksRepository.findById(stock_id)
            if (!stock)
                throw new ResourceNotFoundError()
        }
        if(quantity <= 0 || salesValue <= 0)
            throw new OnlyNaturalNumbersError()


        const treatmentItem = await this.treatmentItemsRepository.create({
            treatment_id, item_id, stock_id, quantity, salesValue
        })
        return {
            treatmentItem
        }
    }
}

