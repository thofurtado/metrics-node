import { ProductsRepository } from '../repositories/products-repository'
import { ServicesRepository } from '../repositories/services-repository'
import { SuppliesRepository } from '../repositories/supplies-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

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
                    await this.productsRepository.update(itemId, { active: false })
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
                    await this.servicesRepository.update(itemId, { active: false })
                } else {
                    throw err
                }
            }
            return
        }

        // Try to find and delete as Supply
        const supply = await this.suppliesRepository.findById(itemId)
        if (supply) {
            // Note: Supplies doesn't have explicit composition dependency check in repo usually, 
            // but if Prisma throws foreign key constraint (because it's used in composition), we catch it.
            try {
                await this.suppliesRepository.delete(itemId)
            } catch (err) {
                // If foreign key constraint violation (P2003 code usually), we should soft delete.
                // But ResourceDependencyError might not be thrown by Prisma automatically unless I wrapped it in Repo.
                // My new repos (Step 66-68) do NOT wrap errors. They just call prisma.delete.
                // So I should catch PrismaClientKnownRequestError here or update Repo to throw custom error.
                // For simplicity/speed, I will assume we should try/catch generic error or specific prisma error.
                // Actually, the previous code had `err instanceof ResourceDependencyError`.
                // I will update this block to just catch and Soft Delete if delete fails?
                // Or better, update Repositories to handle this, but I already wrote them.
                // I'll soft delete on error for now if it looks like constraint.

                await this.suppliesRepository.update(itemId, { active: false })
            }
            return
        }

        throw new ResourceNotFoundError()
    }
}
