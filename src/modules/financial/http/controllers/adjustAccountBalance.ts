import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeAdjustAccountBalanceUseCase } from '@/modules/financial/use-cases/factories/make-adjust-account-balance-use-case'

export async function adjustAccountBalance(request: FastifyRequest, reply: FastifyReply) {
    const adjustAccountBalanceBodySchema = z.object({
        newBalance: z.number(),
    })

    const adjustAccountBalanceParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { newBalance } = adjustAccountBalanceBodySchema.parse(request.body)
    const { id } = adjustAccountBalanceParamsSchema.parse(request.params)

    try {
        const adjustAccountBalanceUseCase = makeAdjustAccountBalanceUseCase()

        await adjustAccountBalanceUseCase.execute({
            id,
            newBalance,
        })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }

    return reply.status(200).send()
}
