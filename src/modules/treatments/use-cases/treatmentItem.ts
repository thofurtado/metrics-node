import { TreatmentItemsRepository } from '@/modules/treatments/repositories/treatmentItems-repository'
import { TreatmentItem, Product, Service, Supply } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { ItemsRepository } from '@/modules/items/repositories/items-repository'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'
import { InsufficientStockError } from '@/modules/stock/use-cases/insufficient-stock-error'

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

        try {
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

            // --- STOCK VALIDATION LOGIC ("Regra de Ouro": Venda Prioritária) ---
            // A venda NÃO é bloqueada por estoque insuficiente. Apenas loga aviso.

            // Step 1: Identify Type
            const isService = item?.type === 'SERVICE' || !!item?.service

            if (isService) {
                // LOGIC: Services are infinite. Skip validation.
            }
            else if (item?.product) {
                const product = item.product

                if (product.is_composite) {
                    // Step 3: Composite Product
                    const compositions = product.compositions || []

                    for (const comp of compositions) {
                        const ingredient = comp.supply
                        if (!ingredient) continue

                        const quantityNeededPerUnit = comp.quantity
                        const totalRequired = quantityNeededPerUnit * quantity
                        const availableStock = ingredient.stock || 0

                        if (availableStock < totalRequired) {
                            console.warn(`[WARN] Estoque negativo gerado para Insumo Composto: ${ingredient.name}. Necessário: ${totalRequired}, Disponível: ${availableStock}`)
                            // NÃO LANÇA ERRO
                        }
                    }
                } else {
                    // Step 4: Simple Product
                    const productStock = Number(product.stock || 0)
                    const requestedQuantity = Number(quantity)

                    if (productStock < requestedQuantity) {
                        console.warn(`[WARN] Estoque negativo gerado para Produto Simples: ${item.name}. Estoque Banco: ${productStock}, Solicitado: ${requestedQuantity}`)
                        // NÃO LANÇA ERRO
                    }
                }
            }
            else if (item?.supply) {
                // Extra: Supplies (sold directly)
                const supplyStock = Number(item.supply.stock || 0)
                const req = Number(quantity)

                if (supplyStock < req) {
                    console.warn(`[WARN] Estoque negativo gerado para Insumo Direto: ${item.name}. Disponível: ${supplyStock}, Solicitado: ${req}`)
                    // NÃO LANÇA ERRO
                }
            }

            let product_id: string | undefined = undefined
            let service_id: string | undefined = undefined
            let supply_id: string | undefined = undefined

            if (item?.type === 'PRODUCT' || item?.product) product_id = item_id
            else if (item?.type === 'SERVICE') service_id = item_id
            else if (item?.type === 'SUPPLY' || item?.supply) supply_id = item_id

            // --- UPSERT LOGIC (The Fix for 409) ---

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

        } catch (err) {
            console.error('========================================');
            console.error('[FATAL ERROR] Erro capturado no UseCase:');
            console.error('Tipo do Erro:', (err as any).constructor.name);
            console.error('Mensagem:', (err as any).message);
            // console.error('Stack:', (err as any).stack); // Opcional, pode poluir muito
            console.error('========================================');
            throw err;
        }
    }
}
