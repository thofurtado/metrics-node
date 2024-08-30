import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetMonthByDaysUseCase } from '@/use-cases/factories/make-get-month-income-by-days'

export async function getMonthIncomeByDay(request: FastifyRequest, reply: FastifyReply) {
    let monthIncomeByDay
    try {
        const getMonthIncomeByDayUseCase = MakeGetMonthByDaysUseCase()
        monthIncomeByDay = await getMonthIncomeByDayUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(monthIncomeByDay)
}


