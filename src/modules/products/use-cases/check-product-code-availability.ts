import { ProductsRepository } from '@/modules/products/repositories/products-repository'

interface CheckProductCodeAvailabilityUseCaseRequest {
    code: number
}

interface CheckProductCodeAvailabilityUseCaseResponse {
    available: boolean
}

export class CheckProductCodeAvailabilityUseCase {
    constructor(private productsRepository: ProductsRepository) { }

    async execute({ code }: CheckProductCodeAvailabilityUseCaseRequest): Promise<CheckProductCodeAvailabilityUseCaseResponse> {
        const product = await this.productsRepository.findByDisplayId(code)
        return { available: !product }
    }
}
