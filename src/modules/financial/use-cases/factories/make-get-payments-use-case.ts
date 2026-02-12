import { PrismaPaymentsRepository } from '@/modules/financial/repositories/prisma/prisma-payments-repository'
import { GetPaymentsUseCase } from '@/modules/financial/use-cases/get-payments'

export function MakeGetPaymentsUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const getPaymentsUseCase = new GetPaymentsUseCase(paymentsRepository)

    return getPaymentsUseCase
}