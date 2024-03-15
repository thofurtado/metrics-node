import { PrismaTreatmentItemsRepository } from '@/repositories/prisma/prisma-treatment-items-repository'
import { TreatmentItemUseCase } from '../treatmentItem'
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'




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
