import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { GetAccountHistoryUseCase } from '@/modules/financial/use-cases/get-account-history'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export async function getAccountHistory(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    const getAccountHistoryParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const getAccountHistoryQuerySchema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 20)
    })

    const { id } = getAccountHistoryParamsSchema.parse(request.params)
    const { page, limit } = getAccountHistoryQuerySchema.parse(request.query)

    try {
        const accountsRepository = new PrismaAccountsRepository()
        const getAccountHistoryUseCase = new GetAccountHistoryUseCase(accountsRepository)

        const result = await getAccountHistoryUseCase.execute({
            accountId: id,
            page,
            limit
        })

        return reply.status(200).send(result)
    } catch (err) {
        if (err instanceof z.ZodError) {
            return reply
                .status(400)
                .send({ message: 'Validation error.', issues: err.format() })
        }

        if (err instanceof Error && err.message.includes('Resource not found')) {
            return reply.status(404).send({ message: 'Account not found.' })
        }

        console.error(err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
