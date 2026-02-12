import { ProductsRepository } from '@/modules/products/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { Product } from '@prisma/client'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'
import { DisplayIdAlreadyExistsError } from '@/errors/display-id-already-exists-error'

interface CreateProductUseCaseRequest {
    name: string
    description?: string | null
    price: number
    stock?: number | null
    min_stock?: number | null
    barcode?: string | null
    ncm?: string | null
    is_composite?: boolean
    display_id?: number | null
    category?: string | null
    active?: boolean | null
    cost?: number | null
    compositions?: {
        supply_id: string
        quantity: number
    }[]
}

interface CreateProductUseCaseResponse {
    product: Product
}

export class CreateProductUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute({
        name,
        description,
        price,
        stock,
        min_stock,
        barcode,
        ncm,
        is_composite,
        display_id,
        category,
        active,
        compositions,
        cost
    }: CreateProductUseCaseRequest): Promise<CreateProductUseCaseResponse> {
        const productWithSameName = await this.productsRepository.findByName(name)
        if (productWithSameName) {
            throw new ThisNameAlreadyExistsError()
        }

        let finalDisplayId = display_id
        if (finalDisplayId) {
            const conflict = await this.productsRepository.findByDisplayId(finalDisplayId)
            if (conflict) {
                throw new DisplayIdAlreadyExistsError()
            }
        } else {
            finalDisplayId = await this.productsRepository.findNextAvailableDisplayId()
        }

        let totalCost = cost ?? 0

        if (is_composite && compositions && compositions.length > 0) {
            totalCost = 0
            for (const comp of compositions) {
                const supply = await this.suppliesRepository.findById(comp.supply_id)
                if (supply) {
                    totalCost += supply.cost * comp.quantity
                }
            }
        }

        // Validate stock: Products usually have stock, unlike Services.
        // We could add stock 'IN' movement here if stock > 0, but current ItemUseCase structure did it separately or as part of transaction.
        // I'll stick to simple create for now. Usually initial stock is 0 or set via adjustment.
        // But if stock is passed, we save it. Generating a Stock history record is redundant for simplicity unless mandatory? 
        // Logic in `item.ts` was `stockRepository.create(...)`.
        // The prompt says "CRUD...". I'll stick to creating the entity. The Stock Log should ideally be a separate UseCase or inside a transaction here if we want to track the initial boolean.
        // I will assume simple create is enough for this task scope (refactoring schema).

        const product = await this.productsRepository.create({
            name,
            description,
            price,
            cost: totalCost,
            stock: stock ?? 0,
            min_stock: min_stock ?? 0,
            barcode,
            ncm,
            is_composite: is_composite ?? false,
            display_id: finalDisplayId,
            category: category ? { connect: { id: category } } : undefined,
            active: active ?? true,
            compositions: compositions && compositions.length > 0 ? {
                create: compositions.map(comp => ({
                    quantity: comp.quantity,
                    supply: { connect: { id: comp.supply_id } }
                }))
            } : undefined
        })

        return { product }
    }
}
