import { PrismaTreatmentItemsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatment-items-repository'
import { TreatmentItemUseCase } from '@/modules/treatments/use-cases/treatmentItem'
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/modules/items/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'

export function MakeTreatmentItemUseCase() {
    const treatmentItemsRepository = new PrismaTreatmentItemsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const productsRepository = new PrismaProductsRepository()
    const servicesRepository = new PrismaServicesRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const stocksRepository = new PrismaStocksRepository()

    const treatmentItemUseCase = new TreatmentItemUseCase(
        treatmentItemsRepository,
        treatmentsRepository,
        productsRepository,
        servicesRepository,
        suppliesRepository,
        stocksRepository
    )
    return treatmentItemUseCase
}
