import { TreatmentItemsRepository } from '@/repositories/treatmentItems-repository'
import { TreatmentItem } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { StocksRepository } from '@/repositories/stocks-repository'
import { ItemsRepository } from '@/repositories/items-repository'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { InsufficientStockError } from './errors/insufficient-stock-error'

interface TreatmentItemUseCaseRequest {
    item_id: string
    treatment_id: string
    stock_id?: string
    quantity: number
    salesValue: number
    discount?: number
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
        item_id, treatment_id, stock_id, quantity, salesValue, discount
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
        if (quantity <= 0 || salesValue < 0)
            throw new OnlyNaturalNumbersError()
        // Check if item should be treated as a product (has physical stock)
        // Services or items with name starting with 'Serviço'/'Clonagem' (safeguard) should skip stock check
        const isService = item?.type === 'SERVICE' || item?.name?.toLowerCase().includes('clonagem') || item?.category?.toLowerCase().includes('servi')

        let availableStock = 0
        if (item?.product) availableStock = item.product.stock || 0
        else if (item?.supply) availableStock = item.supply.stock || 0

        if (item && !isService && quantity > availableStock) {
            console.error(`[TreatmentItemUseCase] Stock Blocked: Item ${item.name} (Type: ${item.type}), Stock: ${availableStock}, Req: ${quantity}`)
            throw new InsufficientStockError(`Estoque insuficiente. Disponível: ${availableStock}, Requisitado: ${quantity}`)
        }

        const treatmentItem = await this.treatmentItemsRepository.create({
            treatment_id, item_id, stock_id, quantity, salesValue, discount
        })

        return {
            treatmentItem
        }
    }
}
