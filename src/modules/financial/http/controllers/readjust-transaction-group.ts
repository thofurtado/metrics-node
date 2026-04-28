import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeReadjustTransactionGroupUseCase } from '@/modules/financial/use-cases/factories/make-readjust-transaction-group-use-case'

export async function readjustTransactionGroup(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        groupId: z.string().uuid()
    })

    const bodySchema = z.object({
        mode: z.enum(['renegotiate', 'fix']),
        installmentsCount: z.number().int().min(1),
        totalAmount: z.number().optional(),
        firstDueDate: z.coerce.date()
    })

    const { groupId } = paramsSchema.parse(request.params)
    const { mode, installmentsCount, totalAmount, firstDueDate } = bodySchema.parse(request.body)

    try {
        const useCase = MakeReadjustTransactionGroupUseCase()
        await useCase.execute({
            groupId,
            mode,
            installmentsCount,
            totalAmount,
            firstDueDate
        })

        return reply.status(200).send()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
