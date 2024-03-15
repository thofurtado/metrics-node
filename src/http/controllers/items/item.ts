import { MakeItemUseCase } from '@/use-cases/factories/make-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createItem(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        description: z.string().nullish(),
        cost: z.number(),
        price: z.number(),
        stock: z.number().nullish(),
        active: z.boolean().nullish(),
        isItem: z.boolean().nullish()
    })

    const { name, description, cost, price, stock, active, isItem } = registerBodySchema.parse(request.body)
    let item
    try {

        const itemUseCase = MakeItemUseCase()

        item = await itemUseCase.execute({
            name,
            description: description ? description : undefined,
            cost,
            price,
            stock: stock ? stock : undefined,
            active: active ? active : undefined,
            isItem: isItem ? isItem : undefined
        })
    } catch (err) {

        return reply.status(409).send()

        throw err
    }
    return reply.status(200).send(item)
}


