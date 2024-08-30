import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetMonthExpenseBySectorUseCase } from '@/use-cases/factories/make-get-month-expense-by-sector'

export async function getMonthExpenseBySector(request: FastifyRequest, reply: FastifyReply) {
    let monthExpenseBySector
    try {
        const getMonthExpenseBySectorUseCase = MakeGetMonthExpenseBySectorUseCase()
        monthExpenseBySector = await getMonthExpenseBySectorUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(monthExpenseBySector)
}


