import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { PrismaPaymentEntrysRepository } from '@/modules/financial/repositories/prisma/prisma-payment-entrys-repository'
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { FinishTreatmentUseCase } from '@/modules/treatments/use-cases/finish-treatment'

export function MakeFinishTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const paymentEntrysRepository = new PrismaPaymentEntrysRepository()
    const transactionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    const finishTreatmentUseCase = new FinishTreatmentUseCase(
        treatmentsRepository,
        paymentEntrysRepository,
        transactionsRepository,
        accountsRepository,
        productsRepository,
        suppliesRepository
    )
    return finishTreatmentUseCase
}
