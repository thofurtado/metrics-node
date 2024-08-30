import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetMonthIncomeAmountUseCase } from '@/use-cases/factories/make-get-month-income-amount-use-case'

export async function getMonthIncomeAmount(request: FastifyRequest, reply: FastifyReply) {
    let monthIncomeAmount
    try {
        const getMonthIncomeAmountUseCase = MakeGetMonthIncomeAmountUseCase()
        monthIncomeAmount = await getMonthIncomeAmountUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(monthIncomeAmount)
}


