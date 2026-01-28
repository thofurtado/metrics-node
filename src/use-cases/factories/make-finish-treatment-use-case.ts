import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { PrismaPaymentEntrysRepository } from '@/repositories/prisma/prisma-payment-entrys-repository'
import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'
import { FinishTreatmentUseCase } from '../finish-treatment'

export function MakeFinishTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const paymentEntrysRepository = new PrismaPaymentEntrysRepository()
    const itemsRepository = new PrismaItemsRepository()
    const transactionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()

    const finishTreatmentUseCase = new FinishTreatmentUseCase(
        treatmentsRepository,
        paymentEntrysRepository,
        itemsRepository,
        transactionsRepository,
        accountsRepository
    )
    return finishTreatmentUseCase
}
