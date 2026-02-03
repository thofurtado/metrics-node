import { MakeTreatmentItemUseCase } from '@/use-cases/factories/make-treatment-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { InsufficientStockError } from '@/use-cases/errors/insufficient-stock-error'




export async function createItemTreatment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        treatment_id: z.string(),
        item_id: z.string(),
        stock_id: z.string().nullish(),
        quantity: z.number(),
        value: z.number(),
        discount: z.number().nullish()
    })

    console.log('Controller createItemTreatment body:', request.body)
    const { treatment_id, item_id, stock_id, quantity, value, discount } = registerBodySchema.parse(request.body)

    let itemTreatment
    try {

        const itemtreatmentUseCase = MakeTreatmentItemUseCase()

        itemTreatment = await itemtreatmentUseCase.execute({
            treatment_id,
            item_id,
            stock_id: stock_id ? stock_id : undefined,
            quantity,
            salesValue: value,
            discount: discount ? discount : 0
        })
    } catch (err) {
        if (err instanceof InsufficientStockError) {
            // User requested 409 for stock errors with explicit message
            return reply.status(409).send({ message: err.message })
        }
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send(itemTreatment)
}


