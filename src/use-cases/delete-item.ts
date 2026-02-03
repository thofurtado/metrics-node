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
            await this.productsRepository.delete(itemId)
            return
        }

        // Try to find and delete as Service
        const service = await this.servicesRepository.findById(itemId)
        if (service) {
            await this.servicesRepository.delete(itemId)
            return
        }

        // Try to find and delete as Supply
        const supply = await this.suppliesRepository.findById(itemId)
        if (supply) {
            // Business Rule: Check if Supply is used in any Product Composition
            const dependentProducts = await this.productsRepository.findManyBySupplyId(itemId)
            if (dependentProducts.length > 0) {
                const productNames = dependentProducts.map(p => p.name).join(', ')
                throw new ResourceDependencyError(`Este insumo não pode ser apagado pois está sendo utilizado nos seguintes produtos: ${productNames}`)
            }

            await this.suppliesRepository.delete(itemId)
            return
        }

        // If not found in any
        throw new ResourceNotFoundError()
    }
}
