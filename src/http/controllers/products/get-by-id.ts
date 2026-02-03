import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetProductByIdUseCase } from '@/use-cases/factories/make-get-product-by-id-use-case'

export async function getById(request: FastifyRequest, reply: FastifyReply) {
    const getProductParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = getProductParamsSchema.parse(request.params)

    const getProductByIdUseCase = makeGetProductByIdUseCase()

    const { product } = await getProductByIdUseCase.execute({ id })

    return reply.status(200).send(product)
}
