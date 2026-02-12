import { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaCategoriesRepository } from '@/repositories/prisma/prisma-categories-repository'
import { FetchCategoriesUseCase } from '@/modules/categories/use-cases/fetch-categories'

export async function fetch(request: FastifyRequest, reply: FastifyReply) {
    const categoriesRepository = new PrismaCategoriesRepository()
    const fetchCategoriesUseCase = new FetchCategoriesUseCase(categoriesRepository)

    const { categories } = await fetchCategoriesUseCase.execute()

    return reply.status(200).send({
        categories,
    })
}
