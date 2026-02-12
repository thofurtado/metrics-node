import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { PrismaCategoriesRepository } from '@/repositories/prisma/prisma-categories-repository'
import { CreateCategoryUseCase } from '@/modules/categories/use-cases/create-category'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createCategoryBodySchema = z.object({
        name: z.string(),
    })

    const { name } = createCategoryBodySchema.parse(request.body)

    const categoriesRepository = new PrismaCategoriesRepository()
    const createCategoryUseCase = new CreateCategoryUseCase(categoriesRepository)

    try {
        const { category } = await createCategoryUseCase.execute({
            name,
        })
        return reply.status(201).send({ category })
    } catch (err) {
        if (err instanceof Error && err.message === 'Category already exists.') {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
