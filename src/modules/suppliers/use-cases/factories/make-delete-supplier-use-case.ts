import { PrismaSuppliersRepository } from '@/modules/suppliers/repositories/prisma/prisma-suppliers-repository'
import { DeleteSupplierUseCase } from '@/modules/suppliers/use-cases/delete-supplier'

export function makeDeleteSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const deleteSupplierUseCase = new DeleteSupplierUseCase(prismaSuppliersRepository)

    return deleteSupplierUseCase
}
