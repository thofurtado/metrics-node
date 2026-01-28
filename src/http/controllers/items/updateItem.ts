import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeUpdateItemUseCase } from '@/use-cases/factories/make-update-item-use-case'

export async function updateItem(request: FastifyRequest, reply: FastifyReply) {
    const updateItemParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateItemBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().nullish(),
        cost: z.number().optional(),
        price: z.number().optional(),
        min_stock: z.number().nullish(),
        barcode: z.string().nullish(),
        category: z.string().nullish(),
        active: z.boolean().optional(),
        isItem: z.boolean().optional(),
    })

    const { id } = updateItemParamsSchema.parse(request.params)
    const data = updateItemBodySchema.parse(request.body)

    try {
        const updateItemUseCase = makeUpdateItemUseCase()
        const { item } = await updateItemUseCase.execute({
            id,
            ...data,
            description: data.description ?? undefined,
            min_stock: data.min_stock ?? undefined,
            barcode: data.barcode ?? undefined,
            category: data.category ?? undefined,
        })
        return reply.status(200).send(item)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
