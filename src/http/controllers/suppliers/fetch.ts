import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetSuppliersUseCase } from '@/use-cases/factories/make-get-suppliers-use-case'

export async function fetch(request: FastifyRequest, reply: FastifyReply) {
    const fetchSuppliersQuerySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).default(10),
        query: z.string().optional(),
    })

    const { page, perPage, query } = fetchSuppliersQuerySchema.parse(request.query)

    const getSuppliersUseCase = makeGetSuppliersUseCase()

    const { suppliers, count } = await getSuppliersUseCase.execute({
        page,
        perPage,
        query,
    })

    return reply.status(200).send({
        suppliers,
        count
    })
}
