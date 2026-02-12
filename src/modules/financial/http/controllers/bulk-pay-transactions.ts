import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeBulkPayTransactionsUseCase } from '@/modules/financial/use-cases/factories/make-bulk-pay-transactions-use-case'

export async function bulkPayTransactions(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        transactionIds: z.array(z.string().uuid())
    })

    const { transactionIds } = bodySchema.parse(request.body)

    try {
        const useCase = MakeBulkPayTransactionsUseCase()
        await useCase.execute({ transactionIds })
        return reply.status(200).send()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
