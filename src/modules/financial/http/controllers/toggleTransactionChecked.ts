import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function toggleTransactionChecked(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    const toggleCheckedParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const toggleCheckedBodySchema = z.object({
        checked: z.boolean(),
    })

    const { id } = toggleCheckedParamsSchema.parse(request.params)
    const { checked } = toggleCheckedBodySchema.parse(request.body)

    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id },
        })

        if (!transaction) {
            return reply.status(404).send({ message: 'Transaction not found.' })
        }

        await prisma.transaction.update({
            where: { id },
            data: { checked },
        })

        return reply.status(204).send()
    } catch (err) {
        if (err instanceof z.ZodError) {
            return reply
                .status(400)
                .send({ message: 'Validation error.', issues: err.format() })
        }

        console.error(err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
