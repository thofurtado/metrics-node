import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'
import { RegisterStockMovementUseCase } from '@/use-cases/stock/register-movement'

export function MakeRegisterStockMovementUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const stocksRepository = new PrismaStocksRepository()

    const useCase = new RegisterStockMovementUseCase(stocksRepository, itemsRepository)

    return useCase
}
