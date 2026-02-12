// controllers/get-inventory-summary.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetInventorySummaryUseCase } from '@/modules/stock/use-cases/factories/make-get-inventory-summary-use-case'

export async function getInventorySummary(request: FastifyRequest, reply: FastifyReply) {
    let inventorySummary

    try {
        const getInventorySummaryUseCase = MakeGetInventorySummaryUseCase()
        inventorySummary = await getInventorySummaryUseCase.execute()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(500).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(inventorySummary)
}