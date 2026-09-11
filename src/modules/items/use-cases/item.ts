import { resolveCategoryClause } from './update-item'
import { ProductsRepository } from '../repositories/products-repository'
import { ServicesRepository } from '../repositories/services-repository'
import { SuppliesRepository } from '../repositories/supplies-repository'
import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { prisma } from '@/lib/prisma'

export enum ItemType {
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
    SUPPLY = 'SUPPLY'
}

interface CreateItemUseCaseRequest {
    name: string,
    description?: string,
    cost?: number,
    price?: number,
    stock?: number,
    min_stock?: number,
    barcode?: string,
    category?: string,
    active?: boolean,
    type: ItemType,
    display_id?: number,
    ncm?: string,
    estimated_time?: string,
    unit?: string
}

export class CreateItemUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private servicesRepository: ServicesRepository,
        private suppliesRepository: SuppliesRepository,
        private stockRepository: StocksRepository
    ) { }

    async execute({
        name, description, cost, price, stock, min_stock, barcode, category, active, type, display_id, ncm, estimated_time, unit
    }: CreateItemUseCaseRequest) {

        // 1. Check Name Uniqueness
        let exists = false
        if (type === 'PRODUCT') exists = !!(await this.productsRepository.findByName(name))
        if (type === 'SERVICE') exists = !!(await this.servicesRepository.findByName(name))
        if (type === 'SUPPLY') exists = !!(await this.suppliesRepository.findByName(name))

        if (exists) {
            throw new ThisNameAlreadyExistsError()
        }

        // 2. Validations
        if (price !== undefined && price < 0) throw new OnlyNaturalNumbersError()
        if (cost !== undefined && cost < 0) throw new OnlyNaturalNumbersError()
        if (stock !== undefined && stock < 0) throw new OnlyNaturalNumbersError()

        return await prisma.$transaction(async (tx) => {
            let item: any

            if (type === 'PRODUCT') {
                // Display ID
                let finalDisplayId = display_id
                if (!finalDisplayId) {
                    finalDisplayId = await this.productsRepository.findNextAvailableDisplayId(tx)
                }

                item = await this.productsRepository.create({
                    name,
                    description,
                    category: resolveCategoryClause(category),
                    price: price ?? 0,
                    stock: stock || 0,
                    min_stock: min_stock || 0,
                    barcode,
                    ncm,
                    display_id: finalDisplayId!,
                    active: active ?? true
                }, tx)

            } else if (type === 'SERVICE') {
                let finalDisplayId = display_id
                if (!finalDisplayId) {
                    finalDisplayId = await this.servicesRepository.findNextAvailableDisplayId(tx)
                }

                item = await this.servicesRepository.create({
                    name,
                    description,
                    category: category,
                    price: price ?? 0,
                    estimated_time,
                    active: active ?? true,
                    display_id: finalDisplayId!
                }, tx)

            } else if (type === 'SUPPLY') {
                item = await this.suppliesRepository.create({
                    name,
                    description,
                    category: category,
                    cost: cost ?? 0,
                    stock: stock || 0,
                    unit: unit || 'UN',
                    active: active ?? true
                }, tx)
            }

            // Stock Log
            if (stock && stock !== 0 && (type === 'PRODUCT' || type === 'SUPPLY')) {
                const stockData: any = {
                    quantity: stock,
                    operation: 'IN',
                    description: 'AJUSTE_POSITIVO',
                    created_at: new Date()
                }
                if (type === 'PRODUCT') stockData.product_id = item.id
                if (type === 'SUPPLY') stockData.supply_id = item.id

                await this.stockRepository.create(stockData, tx)
            }

            return { item }
        })
    }
}
