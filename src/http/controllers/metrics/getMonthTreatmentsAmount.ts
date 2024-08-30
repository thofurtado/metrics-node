import { FastifyRequest, FastifyReply } from 'fastify'
import { makeGetMonthTreatmentsAmountUseCase } from '@/use-cases/factories/make-get-month-treatments-amount'

export async function getMonthTreatmentsAmount(request: FastifyRequest, reply: FastifyReply) {
    let monthTreatmentsAmount
    try {
        const getMonthTreatmentsAmountUseCase = makeGetMonthTreatmentsAmountUseCase()
        monthTreatmentsAmount = await getMonthTreatmentsAmountUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(monthTreatmentsAmount)
}


