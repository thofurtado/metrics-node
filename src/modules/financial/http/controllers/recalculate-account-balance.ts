import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { RecalculateAccountBalanceUseCase } from '@/modules/financial/use-cases/recalculate-account-balance'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function recalculateAccountBalance(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    const accountsRepository = new PrismaAccountsRepository()
    const recalculateUseCase = new RecalculateAccountBalanceUseCase(accountsRepository)

    try {
        const { account } = await recalculateUseCase.execute({ id })
        return reply.status(200).send(account)
    } catch (error) {
        if (error instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: error.message })
        }
        throw error
    }
}
