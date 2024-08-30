import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetMonthExpenseAmountUseCase } from '@/use-cases/factories/make-get-month-expense-amount-use-case'

export async function getMonthExpenseAmount(request: FastifyRequest, reply: FastifyReply) {
    let monthExpenseAmount
    try {
        const getMonthExpenseAmountUseCase = MakeGetMonthExpenseAmountUseCase()
        monthExpenseAmount = await getMonthExpenseAmountUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(monthExpenseAmount)
}


