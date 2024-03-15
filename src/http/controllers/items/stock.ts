import { MakeStockUseCase } from '@/use-cases/factories/make-stock-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createStock(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        item_id: z.string(),
        quantity: z.number(),
        operation: z.string(),
        description : z.string().nullish(),
        created_at:  z.date().nullish(),
    })

    const { item_id, quantity, operation, description, created_at } = registerBodySchema.parse(request.body)
    let stock
    try {

        const stockUseCase = MakeStockUseCase()

        stock = await stockUseCase.execute({
            item_id,
            description: description ? description : undefined,
            quantity,
            operation,
            created_at: created_at ? created_at : undefined
        })
    } catch (err) {

        return reply.status(409).send()

        throw err
    }
    return reply.status(200).send(stock)
}


