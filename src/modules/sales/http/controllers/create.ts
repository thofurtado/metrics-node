import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeCreateSaleUseCase } from '../../use-cases/factories/make-create-sale-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createSaleBodySchema = z.object({
        items: z.array(z.object({
            product_id: z.string().uuid().nullish(),
            service_id: z.string().uuid().nullish(),
            supply_id: z.string().uuid().nullish(),
            quantity: z.number().positive(),
            salesValue: z.number().nonnegative(),
            discount: z.number().nonnegative().default(0),
        })),
        discount: z.number().nonnegative().default(0),
        payments: z.array(z.object({
            payment_id: z.string().uuid(),
            amount: z.number().positive(),
            occurrences: z.number().int().positive().default(1),
        }))
    })

    const body = createSaleBodySchema.parse(request.body)

    try {
        const createSaleUseCase = MakeCreateSaleUseCase()

        const { sale } = await createSaleUseCase.execute({
            items: body.items.map(i => ({
                product_id: i.product_id || undefined,
                service_id: i.service_id || undefined,
                supply_id: i.supply_id || undefined,
                quantity: i.quantity,
                salesValue: i.salesValue,
                discount: i.discount
            })),
            discount: body.discount,
            payments: body.payments
        })

        return reply.status(201).send({
            message: 'Sale created successfully',
            sale
        })
    } catch (err) {
        if (err instanceof Error) {
            console.error('Error creating sale:', err)
            return reply.status(400).send({ message: err.message })
        }

        throw err
    }
}
