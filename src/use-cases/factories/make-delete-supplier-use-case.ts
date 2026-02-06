import { PrismaSuppliersRepository } from '@/repositories/prisma/prisma-suppliers-repository'
import { DeleteSupplierUseCase } from '../delete-supplier'

export function makeDeleteSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const deleteSupplierUseCase = new DeleteSupplierUseCase(prismaSuppliersRepository)

    return deleteSupplierUseCase
}
