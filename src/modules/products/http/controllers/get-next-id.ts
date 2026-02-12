import { FastifyReply, FastifyRequest } from 'fastify'
import { makeGetNextProductIdUseCase } from '@/modules/products/use-cases/factories/make-get-next-product-id-use-case'

export async function getNextId(request: FastifyRequest, reply: FastifyReply) {
    const getNextProductIdUseCase = makeGetNextProductIdUseCase()

    const { nextId } = await getNextProductIdUseCase.execute()

    return reply.status(200).send({ nextId })
}
