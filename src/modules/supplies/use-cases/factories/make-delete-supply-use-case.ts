import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { DeleteSupplyUseCase } from '@/modules/supplies/use-cases/delete-supply'

export function makeDeleteSupplyUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const useCase = new DeleteSupplyUseCase(suppliesRepository)

    return useCase
}
