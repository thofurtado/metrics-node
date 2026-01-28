import { PrismaAccountsRepository } from "@/repositories/prisma/prisma-accounts-repository"
import { PrismaPaymentsRepository } from "@/repositories/prisma/prisma-payments-repository"
import { UpdatePaymentUseCase } from "../update-payment"

export function MakeUpdatePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const updatePaymentUseCase = new UpdatePaymentUseCase(paymentsRepository, accountsRepository)

    return updatePaymentUseCase
}
