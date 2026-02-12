import { PrismaSuppliersRepository } from '@/modules/suppliers/repositories/prisma/prisma-suppliers-repository'
import { UpdateSupplierUseCase } from '@/modules/suppliers/use-cases/update-supplier'

export function makeUpdateSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const updateSupplierUseCase = new UpdateSupplierUseCase(prismaSuppliersRepository)

    return updateSupplierUseCase
}
