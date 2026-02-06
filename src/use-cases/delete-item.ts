import { ProductsRepository } from '@/repositories/products-repository'
import { ServicesRepository } from '@/repositories/services-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { ResourceDependencyError } from './errors/resource-dependency-error'

interface DeleteItemUseCaseRequest {
    itemId: string
}

export class DeleteItemUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private servicesRepository: ServicesRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute({ itemId }: DeleteItemUseCaseRequest): Promise<void> {
        // Try to find and delete as Product
        const product = await this.productsRepository.findById(itemId)
        if (product) {
            try {
                await this.productsRepository.delete(itemId)
            } catch (err) {
                if (err instanceof ResourceDependencyError) {
                    await this.productsRepository.save({ ...product, active: false })
                } else {
                    throw err
                }
            }
            return
        }

        // Try to find and delete as Service
        const service = await this.servicesRepository.findById(itemId)
        if (service) {
            try {
                await this.servicesRepository.delete(itemId)
            } catch (err) {
                if (err instanceof ResourceDependencyError) {
                    await this.servicesRepository.save({ ...service, active: false })
                } else {
                    throw err
                }
            }
            return
        }

        // Try to find and delete as Supply
        const supply = await this.suppliesRepository.findById(itemId)
        if (supply) {
            // Business Rule: Check if Supply is used in any Product Composition
            const dependentProducts = await this.productsRepository.findManyBySupplyId(itemId)
            if (dependentProducts.length > 0) {
                const productNames = dependentProducts.map(p => p.name).join(', ')
                // For supplies used in composition, we MUST enforce soft delete or block?
                // The verification blocks it. 
                // "Recomendamos inativá-lo" implies we should probably soft delete automatically? 
                // User said: "Se o item não tiver nenhum vínculo... delete real... se falhar (vínculo), faz o soft delete"
                // The explicit check here prevents DELETE even if no database constraint fails (logical constraint).
                // I will change this to Soft Delete as well.
                await this.suppliesRepository.save({ ...supply, active: false })
                return
            }

            try {
                await this.suppliesRepository.delete(itemId)
            } catch (err) {
                if (err instanceof ResourceDependencyError) {
                    await this.suppliesRepository.save({ ...supply, active: false })
                } else {
                    throw err
                }
            }
            return
        }

        // If not found in any
        throw new ResourceNotFoundError()
    }
}
