import { SuppliersRepository } from '@/repositories/suppliers-repository'
import { Supplier } from '@prisma/client'

interface GetSuppliersUseCaseRequest {
    page: number
    perPage: number
    query?: string
}

interface GetSuppliersUseCaseResponse {
    suppliers: Supplier[]
    count: number
}

export class GetSuppliersUseCase {
    constructor(private suppliersRepository: SuppliersRepository) { }

    async execute({ page, perPage, query }: GetSuppliersUseCaseRequest): Promise<GetSuppliersUseCaseResponse> {
        const { suppliers, count } = await this.suppliersRepository.findMany(page, perPage, query)
        return { suppliers, count }
    }
}
