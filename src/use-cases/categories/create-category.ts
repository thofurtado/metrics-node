import { CategoriesRepository } from '@/repositories/categories-repository'
import { Category } from '@prisma/client'

interface CreateCategoryUseCaseRequest {
    name: string
}

interface CreateCategoryUseCaseResponse {
    category: Category
}

export class CreateCategoryUseCase {
    constructor(private categoriesRepository: CategoriesRepository) { }

    async execute({
        name,
    }: CreateCategoryUseCaseRequest): Promise<CreateCategoryUseCaseResponse> {
        const categoryWithSameName = await this.categoriesRepository.findByName(name)

        if (categoryWithSameName) {
            throw new Error('Category already exists.')
        }

        const category = await this.categoriesRepository.create({
            name,
        })

        return {
            category,
        }
    }
}
