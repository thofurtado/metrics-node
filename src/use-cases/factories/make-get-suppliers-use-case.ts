import { PrismaSuppliersRepository } from '@/repositories/prisma/prisma-suppliers-repository'
import { GetSuppliersUseCase } from '../get-suppliers'

export function makeGetSuppliersUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const getSuppliersUseCase = new GetSuppliersUseCase(prismaSuppliersRepository)

    return getSuppliersUseCase
}
