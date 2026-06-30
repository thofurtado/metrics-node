import { TreatmentItemsRepository } from '@/modules/treatments/repositories/treatmentItems-repository'
import { TreatmentItem, Product, Service, Supply } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'

// New Repositories
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { ServicesRepository } from '@/modules/items/repositories/services-repository'
import { SuppliesRepository } from '@/modules/items/repositories/supplies-repository'

interface TreatmentItemUseCaseRequest {
    item_id: string
    treatment_id: string
    stock_id?: string
    quantity: number
    salesValue: number
    discount?: number
    observations?: string
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
        private productsRepository: ProductsRepository,
        private servicesRepository: ServicesRepository,
        private suppliesRepository: SuppliesRepository,
        private stocksRepository: StocksRepository
    ) { }
    async execute({
        item_id, treatment_id, stock_id, quantity, salesValue, discount, observations
    }: TreatmentItemUseCaseRequest): Promise<TreatmentItemUseCaseResponse> {
        console.log(`[TreatmentItemUseCase] Executing for Treatment: ${treatment_id}, Item: ${item_id}, Qty: ${quantity}`)

        try {
            // --- 1. FIND ITEM & DETERMINE TYPE ---
            let product: Product | any | null = null
            let service: Service | null = null
            let supply: Supply | null = null
            let itemType: 'PRODUCT' | 'SERVICE' | 'SUPPLY' | null = null
            let itemName = 'Unknown'

            // Try Product first
            product = await this.productsRepository.findById(item_id)
            if (product) {
                itemType = 'PRODUCT'
                itemName = product.name
            } else {
                // Try Service
                service = await this.servicesRepository.findById(item_id)
                if (service) {
                    itemType = 'SERVICE'
                    itemName = service.name
                } else {
                    // Try Supply
                    supply = await this.suppliesRepository.findById(item_id)
                    if (supply) {
                        itemType = 'SUPPLY'
                        itemName = supply.name
                    }
                }
            }

            if (!itemType) {
                throw new ResourceNotFoundError()
            }

            // --- 2. VALIDATE TREATMENT STATUS ---
            let treatment
            if (treatment_id) {
                treatment = await this.treatmentsRepository.findById(treatment_id)
                if (!treatment)
                    throw new ResourceNotFoundError()

                const status = treatment.status?.toLowerCase() || 'pending'
                const blockedStatuses = ['resolved', 'canceled']

                console.log(`[TreatmentItemUseCase] Status Check: ${status}`)

                if (blockedStatuses.includes(status)) {
                    console.error(`[TreatmentItemUseCase] Blocked: Treatment ${treatment_id} is ${status}`)
                    throw new Error(`Não é possível adicionar itens a um atendimento com status: ${treatment.status}`)
                }
            }

            if (quantity <= 0 || salesValue < 0)
                throw new OnlyNaturalNumbersError()


            // --- 3. STOCK VALIDATION LOGIC ---
            // A venda NÃO é bloqueada por estoque insuficiente. Apenas loga aviso.

            if (itemType === 'SERVICE') {
                // Services are infinite. Skip validation.
            }
            else if (itemType === 'PRODUCT' && product) {
                if (product.is_composite) {
                    // Composite Product
                    const compositions = product.compositions || []

                    for (const comp of compositions) {
                        const ingredient = comp.supply
                        if (!ingredient) continue

                        const quantityNeededPerUnit = comp.quantity
                        const totalRequired = quantityNeededPerUnit * quantity
                        const availableStock = ingredient.stock || 0

                        if (availableStock < totalRequired) {
                            console.warn(`[WARN] Estoque negativo gerado para Insumo Composto: ${ingredient.name}. Necessário: ${totalRequired}, Disponível: ${availableStock}`)
                        }
                    }
                } else {
                    // Simple Product
                    const productStock = Number(product.stock || 0)
                    const requestedQuantity = Number(quantity)

                    if (productStock < requestedQuantity) {
                        console.warn(`[WARN] Estoque negativo gerado para Produto Simples: ${itemName}. Estoque Banco: ${productStock}, Solicitado: ${requestedQuantity}`)
                    }
                }
            }
            else if (itemType === 'SUPPLY' && supply) {
                // Supplies (sold directly)
                const supplyStock = Number(supply.stock || 0)
                const req = Number(quantity)

                if (supplyStock < req) {
                    console.warn(`[WARN] Estoque negativo gerado para Insumo Direto: ${itemName}. Disponível: ${supplyStock}, Solicitado: ${req}`)
                }
            }


            // --- 4. UPSERT LOGIC ---
            // Prepare IDs based on type
            const finalProductId = itemType === 'PRODUCT' ? item_id : undefined
            const finalServiceId = itemType === 'SERVICE' ? item_id : undefined
            const finalSupplyId = itemType === 'SUPPLY' ? item_id : undefined


            // Check if item already exists in this treatment
            const existingItem = await this.treatmentItemsRepository.findByTreatmentAndItemId(
                treatment_id,
                finalProductId,
                finalServiceId,
                finalSupplyId
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
                    discount: discount || existingItem.discount,
                    observations: observations !== undefined ? observations : existingItem.observations
                })
            } else {
                console.log(`[TreatmentItemUseCase] Item new. Creating.`)
                // Scenario B: Create new
                treatmentItemResult = await this.treatmentItemsRepository.create({
                    treatment_id,
                    product_id: finalProductId || null,
                    service_id: finalServiceId || null,
                    supply_id: finalSupplyId || null,
                    stock_id: stock_id || null,
                    quantity,
                    salesValue,
                    discount,
                    observations: observations || null
                })
            }

            return {
                treatmentItem: treatmentItemResult
            }

        } catch (err) {
            console.error('========================================');
            console.error('[FATAL ERROR] Erro capturado no UseCase:');
            console.error('Tipo do Erro:', (err as any).constructor.name);
            console.error('Mensagem:', (err as any).message);
            // console.error('Stack:', (err as any).stack); 
            console.error('========================================');
            throw err;
        }
    }
}
