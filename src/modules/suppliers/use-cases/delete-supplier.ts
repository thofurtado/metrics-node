import { SuppliersRepository } from '@/modules/suppliers/repositories/suppliers-repository'

interface DeleteSupplierUseCaseRequest {
    id: string
}

export class DeleteSupplierUseCase {
    constructor(private suppliersRepository: SuppliersRepository) { }

    async execute({ id }: DeleteSupplierUseCaseRequest): Promise<void> {
        await this.suppliersRepository.delete(id)
    }
}
