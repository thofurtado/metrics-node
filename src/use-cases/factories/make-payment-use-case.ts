import { PrismaPaymentsRepository } from '@/repositories/prisma/prisma-payments-repository'
import { PaymentUseCase } from '../payment'
import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'




export function MakePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository)
    return paymentUseCase
}
