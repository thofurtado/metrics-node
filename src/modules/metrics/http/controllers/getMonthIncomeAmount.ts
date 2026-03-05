import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetMonthIncomeAmountUseCase } from '@/modules/financial/use-cases/factories/make-get-month-income-amount-use-case'

export async function getMonthIncomeAmount(request: FastifyRequest, reply: FastifyReply) {
    const getQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : undefined),
        year: z.string().optional().transform(y => y ? Number(y) : undefined),
    })

    const { month, year } = getQuerySchema.parse(request.query)
    const date = (month !== undefined && year !== undefined) ? new Date(year, month - 1, 1) : undefined

    let monthIncomeAmount
    try {
        const getMonthIncomeAmountUseCase = MakeGetMonthIncomeAmountUseCase()
        monthIncomeAmount = await getMonthIncomeAmountUseCase.execute(date)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send(monthIncomeAmount)
}


