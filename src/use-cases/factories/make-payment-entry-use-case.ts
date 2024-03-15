import { PrismaPaymentEntrysRepository } from '@/repositories/prisma/prisma-payment-entrys-repository'
import { PaymentEntryUseCase } from '../paymentEntry'
import { PrismaPaymentsRepository } from '@/repositories/prisma/prisma-payments-repository'
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'




export function MakePaymentEntryUseCase() {
    const paymentEntrysRepository = new PrismaPaymentEntrysRepository()
    const paymentsRepository = new PrismaPaymentsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const paymentEntryUseCase = new PaymentEntryUseCase(paymentEntrysRepository, paymentsRepository, treatmentsRepository)
    return paymentEntryUseCase
}
