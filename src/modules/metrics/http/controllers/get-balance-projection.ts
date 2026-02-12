// controllers/get-balance-projection.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetBalanceProjectionUseCase } from '@/modules/financial/use-cases/factories/make-get-balance-projection-use-case'

interface GetBalanceProjectionQuery {
    days?: string
}

export async function getBalanceProjection(request: FastifyRequest<{ Querystring: GetBalanceProjectionQuery }>, reply: FastifyReply) {
    let projection

    try {
        const days = request.query.days ? parseInt(request.query.days) : undefined
        const getBalanceProjectionUseCase = MakeGetBalanceProjectionUseCase()
        projection = await getBalanceProjectionUseCase.execute({ days })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(projection)
}