import { PrismaPaymentsRepository } from "@/repositories/prisma/prisma-payments-repository"
import { DeletePaymentUseCase } from "../delete-payment"

export function MakeDeletePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const deletePaymentUseCase = new DeletePaymentUseCase(paymentsRepository)

    return deletePaymentUseCase
}
