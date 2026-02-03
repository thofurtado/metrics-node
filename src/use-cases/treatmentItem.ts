import { TreatmentItemsRepository } from '@/repositories/treatmentItems-repository'
import { TreatmentItem, Product, Service, Supply } from '@prisma/client'
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
    treatmentItem: TreatmentItem & {
        product: Product | null
        service: Service | null
        supply: Supply | null
    }
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
        console.log(`[TreatmentItemUseCase] Executing for Treatment: ${treatment_id}, Item: ${item_id}, Qty: ${quantity}`)

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

            // 1. Validation of Treatment Status (Block only resolved/canceled)
            const status = treatment.status?.toLowerCase() || 'pending'
            const blockedStatuses = ['resolved', 'canceled']

            console.log(`[TreatmentItemUseCase] Status Check: ${status}`)

            if (blockedStatuses.includes(status)) {
                console.error(`[TreatmentItemUseCase] Blocked: Treatment ${treatment_id} is ${status}`)
                throw new Error(`Não é possível adicionar itens a um atendimento com status: ${treatment.status}`)
            }
        }
        // Stock ID logic removed if unused or kept minimally. Keeping logic flow.

        if (quantity <= 0 || salesValue < 0)
            throw new OnlyNaturalNumbersError()
        // --- STOCK VALIDATION LOGIC ("Regra de Ouro") ---

        // Step 1: Identify Type
        // We trust the relations loaded by the repository (product, service, supply)

        // Step 2: Service
        const isService = item?.type === 'SERVICE' || !!item?.service

        if (isService) {
            // LOGIC: Services are infinite. Skip validation.
        }

        // Step 3 & 4: Products (Composite vs Simple)
        else if (item?.product) {
            const product = item.product

            if (product.is_composite) {
                // Step 3: Composite Product
                // DO NOT check the main product stock. Check ingredients.
                const compositions = product.compositions || []

                for (const comp of compositions) {
                    // Relation definition: Composition has `supply`
                    const ingredient = comp.supply
                    if (!ingredient) continue // Should not happen if DB is consistent

                    const quantityNeededPerUnit = comp.quantity
                    const totalRequired = quantityNeededPerUnit * quantity
                    const availableStock = ingredient.stock || 0

                    if (availableStock < totalRequired) {
                        const missing = totalRequired - availableStock
                        throw new InsufficientStockError(
                            `Estoque insuficiente do insumo: ${ingredient.name}. Necessário: ${totalRequired.toFixed(2)}, Disponível: ${availableStock.toFixed(2)}`
                        )
                    }
                }
            } else {
                // Step 4: Simple Product
                // Check the product's own stock
                const productStock = Number(product.stock || 0)
                const requestedQuantity = Number(quantity)

                console.log(`[DEBUG ESTOQUE] Produto: ${item.name} | Estoque Banco: ${productStock} (Type: ${typeof productStock}) | Solicitado: ${requestedQuantity} (Type: ${typeof requestedQuantity})`)

                if (productStock < requestedQuantity) {
                    console.error(`[TreatmentItemUseCase] Stock Blocked: Product ${item.name}, Stock: ${productStock}, Req: ${requestedQuantity}`)
                    throw new InsufficientStockError(
                        `Estoque insuficiente. Produto: ${item.name}. Disponível: ${productStock}, Solicitado: ${requestedQuantity}`
                    )
                }
            }
        }

        // Extra: Supplies (sold directly)
        else if (item?.supply) {
            const supplyStock = Number(item.supply.stock || 0)
            const req = Number(quantity)

            if (supplyStock < req) {
                throw new InsufficientStockError(
                    `Estoque insuficiente. Insumo: ${item.name}. Disponível: ${supplyStock}, Solicitado: ${req}`
                )
            }
        }

        let product_id: string | undefined = undefined
        let service_id: string | undefined = undefined
        let supply_id: string | undefined = undefined

        if (item?.type === 'PRODUCT' || item?.product) product_id = item_id
        else if (item?.type === 'SERVICE') service_id = item_id
        else if (item?.type === 'SUPPLY' || item?.supply) supply_id = item_id

        // --- UPSERT LOGIC (The Fix for 409) ---
        try {
            // Check if item already exists in this treatment
            const existingItem = await this.treatmentItemsRepository.findByTreatmentAndItemId(
                treatment_id,
                product_id,
                service_id,
                supply_id
            )

            let treatmentItemResult

            if (existingItem) {
                console.log(`[TreatmentItemUseCase] Item exists (ID: ${existingItem.id}). Updating quantity.`)
                // Scenario A: Update existing
                const newQuantity = existingItem.quantity + quantity
                treatmentItemResult = await this.treatmentItemsRepository.update({
                    id: existingItem.id,
                    quantity: newQuantity,
                    salesValue,
                    discount: discount || existingItem.discount
                })
            } else {
                console.log(`[TreatmentItemUseCase] Item new. Creating.`)
                // Scenario B: Create new
                treatmentItemResult = await this.treatmentItemsRepository.create({
                    treatment_id,
                    product_id: product_id || null,
                    service_id: service_id || null,
                    supply_id: supply_id || null,
                    stock_id: stock_id || null,
                    quantity,
                    salesValue,
                    discount
                })
            }

            return {
                treatmentItem: treatmentItemResult
            }

        } catch (error) {
            console.error('[TreatmentItemUseCase] DB Error:', error)
            if (error instanceof Error) throw new Error(`Erro ao salvar item: ${error.message}`)
            throw error
        }


    }
}
