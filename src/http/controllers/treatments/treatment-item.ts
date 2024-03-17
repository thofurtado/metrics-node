import { MakeTreatmentItemUseCase } from '@/use-cases/factories/make-treatment-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createItemTreatment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        treatment_id: z.string(),
        item_id: z.string(),
        stock_id: z.string().nullish(),
        quantity: z.number(),
        value: z.number()
    })

    const { treatment_id, item_id, stock_id,quantity,value } = registerBodySchema.parse(request.body)

    let itemTreatment
    try {

        const itemtreatmentUseCase = MakeTreatmentItemUseCase()

        itemTreatment = await itemtreatmentUseCase.execute({
            treatment_id,
            item_id,
            stock_id: stock_id ? stock_id : undefined,
            quantity,
            salesValue: value
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(itemTreatment)
}


