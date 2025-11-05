import { PrismaPaymentsRepository } from '@/repositories/prisma/prisma-payments-repository'
import { GetPaymentsUseCase } from '@/use-cases/get-payments'

export function MakeGetPaymentsUseCase() {
    const paymentsRepository = new PrismaPaymentsRepository()
    const getPaymentsUseCase = new GetPaymentsUseCase(paymentsRepository)

    return getPaymentsUseCase
}