import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ProductsRepository } from '@/repositories/products-repository'
import { Supply } from '@prisma/client'
import { ResourceNotFoundError } from '../errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

interface UpdateSupplyUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    cost?: number
    stock?: number
    unit?: string | null
    category?: string | null
    active?: boolean
}

interface UpdateSupplyUseCaseResponse {
    supply: Supply
}

export class UpdateSupplyUseCase {
    constructor(
        private suppliesRepository: SuppliesRepository,
        private productsRepository: ProductsRepository
    ) { }

    async execute(data: UpdateSupplyUseCaseRequest): Promise<UpdateSupplyUseCaseResponse> {
        return await prisma.$transaction(async (tx) => {
            const supply = await this.suppliesRepository.findById(data.id, tx)

            if (!supply) {
                throw new ResourceNotFoundError()
            }

            const updatedSupply = await this.suppliesRepository.save({
                ...supply,
                ...data,
            }, tx)

            // Dynamic Cost Logic: If cost changed, update all products that use this supply
            if (data.cost !== undefined && data.cost !== supply.cost) {
                const affectedProducts = await this.productsRepository.findManyBySupplyId(supply.id, tx)

                for (const product of affectedProducts) {
                    let totalCost = 0
                    const compositions = (product as any).compositions

                    if (compositions) {
                        for (const comp of compositions) {
                            const sId = comp.supply_id
                            const qty = comp.quantity

                            if (sId === supply.id) {
                                totalCost += (data.cost ?? 0) * qty // Use new cost
                            } else {
                                // For other supplies, use existing cost (assuming comp.supply is populated)
                                // If not populated, we might have an issue, but findManyBySupplyId included it.
                                totalCost += (comp.supply?.cost ?? 0) * qty
                            }
                        }

                        const { compositions: _ignored, ...rest } = (product as any)
                        await this.productsRepository.save({
                            ...rest,
                            cost: totalCost
                        } as any, tx)
                    }
                }
            }

            return { supply: updatedSupply }
        })
    }
}
