import { PrismaSuppliersRepository } from '@/repositories/prisma/prisma-suppliers-repository'
import { CreateSupplierUseCase } from '../create-supplier'

export function makeCreateSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const createSupplierUseCase = new CreateSupplierUseCase(prismaSuppliersRepository)

    return createSupplierUseCase
}
