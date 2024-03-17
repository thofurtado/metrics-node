import { MakeRemoveTreatmentItemUseCase } from '@/use-cases/factories/make-remove-treatment-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function RemoveTreatmentItem(request: FastifyRequest, reply: FastifyReply) {

    const deleteItemTreatmentParamsSchema = z.object({
        id:z.string().uuid()
    })
    console.log(request)
    const { id } = deleteItemTreatmentParamsSchema.parse(request.params)

    try {

        const removeTreatmentItemUseCase = MakeRemoveTreatmentItemUseCase()

        await removeTreatmentItemUseCase.execute({
            id
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(204).send()
}


