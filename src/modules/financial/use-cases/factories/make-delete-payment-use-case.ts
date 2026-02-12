import { PrismaPaymentsRepository } from "@/modules/financial/repositories/prisma/prisma-payments-repository"
import { DeletePaymentUseCase } from "@/modules/financial/use-cases/delete-payment"

export function MakeDeletePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const deletePaymentUseCase = new DeletePaymentUseCase(paymentsRepository)

    return deletePaymentUseCase
}
