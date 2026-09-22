import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { ReopenTreatmentUseCase } from '@/modules/treatments/use-cases/reopen-treatment'

export function MakeReopenTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    return new ReopenTreatmentUseCase(
        treatmentsRepository,
        accountsRepository,
        productsRepository,
        suppliesRepository
    )
}
