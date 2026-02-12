import { PrismaPaymentsRepository } from '@/modules/financial/repositories/prisma/prisma-payments-repository'
import { PaymentUseCase } from '@/modules/financial/use-cases/payment'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'




export function MakePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository)
    return paymentUseCase
}
