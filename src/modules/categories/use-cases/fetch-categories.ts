import { CategoriesRepository } from '@/repositories/categories-repository'
import { Category } from '@prisma/client'

interface FetchCategoriesUseCaseResponse {
    categories: Category[]
}

export class FetchCategoriesUseCase {
    constructor(private categoriesRepository: CategoriesRepository) { }

    async execute(): Promise<FetchCategoriesUseCaseResponse> {
        const categories = await this.categoriesRepository.findMany()

        return {
            categories,
        }
    }
}
