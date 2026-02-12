import { PrismaTreatmentItemsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatment-items-repository'
import { TreatmentItemUseCase } from '@/modules/treatments/use-cases/treatmentItem'
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'




export function MakeTreatmentItemUseCase() {
    const treatmentItemsRepository = new PrismaTreatmentItemsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const itemsRepository = new PrismaItemsRepository()
    const stocksRepository = new PrismaStocksRepository()
    const treatmentItemUseCase = new TreatmentItemUseCase(
        treatmentItemsRepository,
        treatmentsRepository,
        itemsRepository,
        stocksRepository
    )
    return treatmentItemUseCase
}
