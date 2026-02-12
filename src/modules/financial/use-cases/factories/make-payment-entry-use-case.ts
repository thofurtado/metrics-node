import { PrismaPaymentEntrysRepository } from '@/modules/financial/repositories/prisma/prisma-payment-entrys-repository'
import { PaymentEntryUseCase } from '@/modules/financial/use-cases/paymentEntry'
import { PrismaPaymentsRepository } from '@/modules/financial/repositories/prisma/prisma-payments-repository'
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'




export function MakePaymentEntryUseCase() {
    const paymentEntrysRepository = new PrismaPaymentEntrysRepository()
    const paymentsRepository = new PrismaPaymentsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const paymentEntryUseCase = new PaymentEntryUseCase(paymentEntrysRepository, paymentsRepository, treatmentsRepository)
    return paymentEntryUseCase
}
