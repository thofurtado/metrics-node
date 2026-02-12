// controllers/get-financial-summary.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetFinancialSummaryUseCase } from '@/modules/financial/use-cases/factories/make-get-financial-summary'

export async function getFinancialSummary(request: FastifyRequest, reply: FastifyReply) {
    let financialSummary

    try {
        const getFinancialSummaryUseCase = MakeGetFinancialSummaryUseCase()
        financialSummary = await getFinancialSummaryUseCase.execute()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(financialSummary)
}