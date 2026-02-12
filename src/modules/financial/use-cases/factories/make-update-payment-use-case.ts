import { PrismaAccountsRepository } from "@/modules/financial/repositories/prisma/prisma-accounts-repository"
import { PrismaPaymentsRepository } from "@/modules/financial/repositories/prisma/prisma-payments-repository"
import { UpdatePaymentUseCase } from "@/modules/financial/use-cases/update-payment"

export function MakeUpdatePaymentUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const updatePaymentUseCase = new UpdatePaymentUseCase(paymentsRepository, accountsRepository)

    return updatePaymentUseCase
}
