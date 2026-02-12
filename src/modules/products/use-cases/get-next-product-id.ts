import { ProductsRepository } from '@/modules/products/repositories/products-repository'

interface GetNextProductIdUseCaseResponse {
    nextId: number
}

export class GetNextProductIdUseCase {
    constructor(private productsRepository: ProductsRepository) { }

    async execute(): Promise<GetNextProductIdUseCaseResponse> {
        const nextId = await this.productsRepository.findNextAvailableDisplayId()
        return { nextId }
    }
}
