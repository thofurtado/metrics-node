import { SuppliersRepository } from '@/modules/suppliers/repositories/suppliers-repository'
import { Supplier } from '@prisma/client'

interface CreateSupplierUseCaseRequest {
    name: string
    document?: string | null
    email?: string | null
    phone?: string | null
}

interface CreateSupplierUseCaseResponse {
    supplier: Supplier
}

export class CreateSupplierUseCase {
    constructor(private suppliersRepository: SuppliersRepository) { }

    async execute({
        name,
        document,
        email,
        phone
    }: CreateSupplierUseCaseRequest): Promise<CreateSupplierUseCaseResponse> {
        const supplier = await this.suppliersRepository.create({
            name,
            document,
            email,
            phone
        })

        return {
            supplier
        }
    }
}
