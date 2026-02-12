import { PrismaSuppliersRepository } from '@/modules/suppliers/repositories/prisma/prisma-suppliers-repository'
import { CreateSupplierUseCase } from '@/modules/suppliers/use-cases/create-supplier'

export function makeCreateSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const createSupplierUseCase = new CreateSupplierUseCase(prismaSuppliersRepository)

    return createSupplierUseCase
}
