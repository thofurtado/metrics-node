import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetInventorySummaryUseCase } from '@/modules/stock/use-cases/factories/make-get-inventory-summary-use-case'

export async function getInventorySummary(request: FastifyRequest, reply: FastifyReply) {
    const getInventoryQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : undefined),
        year: z.string().optional().transform(y => y ? Number(y) : undefined),
    })

    const { month, year } = getInventoryQuerySchema.parse(request.query)
    const date = (month !== undefined && year !== undefined) ? new Date(year, month - 1, 1) : undefined

    let inventorySummary

    try {
        const getInventorySummaryUseCase = MakeGetInventorySummaryUseCase()
        inventorySummary = await getInventorySummaryUseCase.execute(date)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(500).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(inventorySummary)
}