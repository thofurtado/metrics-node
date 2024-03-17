import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTreatmentsUseCase } from '@/use-cases/factories/make-get-treatments-use-case'

export async function getTreatment(request: FastifyRequest, reply: FastifyReply) {
    let treatments
    try {
        const getTreatmentUseCase = MakeGetTreatmentsUseCase()
        treatments = await getTreatmentUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(treatments)
}


