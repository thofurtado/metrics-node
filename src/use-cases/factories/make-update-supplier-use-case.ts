import { PrismaSuppliersRepository } from '@/repositories/prisma/prisma-suppliers-repository'
import { UpdateSupplierUseCase } from '../update-supplier'

export function makeUpdateSupplierUseCase() {
    const prismaSuppliersRepository = new PrismaSuppliersRepository()
    const updateSupplierUseCase = new UpdateSupplierUseCase(prismaSuppliersRepository)

    return updateSupplierUseCase
}
