import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { RegisterStockMovementUseCase } from '@/modules/stock/use-cases/register-movement'

export function MakeRegisterStockMovementUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const stocksRepository = new PrismaStocksRepository()

    const useCase = new RegisterStockMovementUseCase(stocksRepository, itemsRepository)

    return useCase
}
