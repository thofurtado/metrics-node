import { ProductsRepository } from '../repositories/products-repository'
import { ServicesRepository } from '../repositories/services-repository'
import { SuppliesRepository } from '../repositories/supplies-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

const isUuid = (val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

function resolveCategoryClause(category?: string | null) {
    if (!category || category.trim() === '') return undefined
    const clean = category.trim()
    if (isUuid(clean)) {
        return { connect: { id: clean } }
    }
    return {
        connectOrCreate: {
            where: { name: clean },
            create: { name: clean }
        }
    }
}

interface UpdateItemUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    cost?: number | null
    price?: number | null
    min_stock?: number | null
    barcode?: string | null
    category?: string | null
    active?: boolean | null
    estimated_time?: string | null
    unit?: string | null
    display_id?: number | null
    ncm?: string | null
    stock?: number | null
    is_composite?: boolean
    compositions?: {
        supply_id: string
        quantity: number
    }[]
}

export class UpdateItemUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private servicesRepository: ServicesRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute(data: UpdateItemUseCaseRequest) {
        // 1. Try to find as Product
        const product = await this.productsRepository.findById(data.id)
        if (product) {
            const productUpdate: any = {
                name: data.name,
                description: data.description,
                category: data.category !== undefined ? (data.category ? resolveCategoryClause(data.category) : { disconnect: true }) : undefined,
                active: data.active,
                price: data.price,
                min_stock: data.min_stock,
                stock: data.stock,
                barcode: data.barcode,
                ncm: data.ncm,
                display_id: data.display_id
            }

            // Logic for Composable Product
            if (data.is_composite === false) {
                productUpdate.is_composite = false
                productUpdate.compositions = { deleteMany: {} }
            } else if (data.is_composite === true || (data.is_composite === undefined && product.is_composite)) {
                if (data.is_composite === true) productUpdate.is_composite = true
                if (data.compositions) {
                    productUpdate.compositions = {
                        deleteMany: {},
                        create: data.compositions.map(comp => ({
                            supply_id: comp.supply_id,
                            quantity: comp.quantity
                        }))
                    }
                }
            }

            const updated = await this.productsRepository.update(data.id, productUpdate)
            return { item: updated }
        }

        // 2. Try to find as Service
        const service = await this.servicesRepository.findById(data.id)
        if (service) {
            const serviceUpdate: any = {
                name: data.name,
                description: data.description,
                category: data.category,
                active: data.active,
                price: data.price,
                estimated_time: data.estimated_time,
                display_id: data.display_id,
                // Service Composition Logic (Newly Added)
                compositions: data.compositions ? {
                    deleteMany: {},
                    create: data.compositions.map(comp => ({
                        supply_id: comp.supply_id,
                        quantity: comp.quantity
                    }))
                } : undefined
            }

            const updated = await this.servicesRepository.update(data.id, serviceUpdate)
            return { item: updated }
        }

        // 3. Try to find as Supply
        const supply = await this.suppliesRepository.findById(data.id)
        if (supply) {
            const supplyUpdate: any = {
                name: data.name,
                description: data.description,
                category: data.category,
                active: data.active,
                cost: data.cost,
                unit: data.unit,
                stock: data.stock
            }

            const updated = await this.suppliesRepository.update(data.id, supplyUpdate)
            return { item: updated }
        }

        throw new ResourceNotFoundError()
    }
}
