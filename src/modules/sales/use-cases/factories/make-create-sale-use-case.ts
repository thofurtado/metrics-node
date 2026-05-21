import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { PrismaPaymentsRepository } from '@/modules/financial/repositories/prisma/prisma-payments-repository'
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { PrismaSalesRepository } from '../../repositories/prisma/prisma-sales-repository'
import { CreateSaleUseCase } from '../create-sale'

export function MakeCreateSaleUseCase() {
    const salesRepository = new PrismaSalesRepository()
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const transactionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const paymentsRepository = new PrismaPaymentsRepository()

    const createSaleUseCase = new CreateSaleUseCase(
        salesRepository,
        productsRepository,
        suppliesRepository,
        transactionsRepository,
        accountsRepository,
        paymentsRepository
    )

    return createSaleUseCase
}
