import { SuppliersRepository } from '@/modules/suppliers/repositories/suppliers-repository'
import { Supplier } from '@prisma/client'

interface UpdateSupplierUseCaseRequest {
    id: string
    name?: string
    document?: string | null
    email?: string | null
    phone?: string | null
}

interface UpdateSupplierUseCaseResponse {
    supplier: Supplier
}

export class UpdateSupplierUseCase {
    constructor(private suppliersRepository: SuppliersRepository) { }

    async execute({ id, name, document, email, phone }: UpdateSupplierUseCaseRequest): Promise<UpdateSupplierUseCaseResponse> {
        const supplier = await this.suppliersRepository.update(id, {
            name, document, email, phone
        })
        return { supplier }
    }
}
