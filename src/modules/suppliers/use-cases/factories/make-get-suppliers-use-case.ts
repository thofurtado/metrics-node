import { PrismaSuppliersRepository } from '@/modules/suppliers/repositories/prisma/prisma-suppliers-repository'
import { GetSuppliersUseCase } from '@/modules/suppliers/use-cases/get-suppliers'

export function makeGetSuppliersUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const getSuppliersUseCase = new GetSuppliersUseCase(prismaSuppliersRepository)

    return getSuppliersUseCase
}
