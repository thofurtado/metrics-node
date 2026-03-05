import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetFinancialSummaryUseCase } from '@/modules/financial/use-cases/factories/make-get-financial-summary'

export async function getFinancialSummary(request: FastifyRequest, reply: FastifyReply) {
    const getSummaryQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : undefined),
        year: z.string().optional().transform(y => y ? Number(y) : undefined),
    })

    const { month, year } = getSummaryQuerySchema.parse(request.query)
    const date = (month !== undefined && year !== undefined) ? new Date(year, month - 1, 1) : undefined

    let financialSummary

    try {
        const getFinancialSummaryUseCase = MakeGetFinancialSummaryUseCase()
        financialSummary = await getFinancialSummaryUseCase.execute(date)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(financialSummary)
}