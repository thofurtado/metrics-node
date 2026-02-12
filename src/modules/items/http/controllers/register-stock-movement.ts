
import { MakeRegisterStockMovementUseCase } from '@/modules/stock/use-cases/factories/make-register-stock-movement-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'


export async function registerStockMovement(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        item_id: z.string(),
        quantity: z.coerce.number(),
        operation: z.enum(['IN', 'OUT']),
        description: z.string().nullish(),
        created_at: z.coerce.date().nullish(),
        unit_cost: z.coerce.number().optional()
    })

    const { item_id, quantity, operation, description, created_at, unit_cost } = registerBodySchema.parse(request.body)

    try {

        const registerStockMovementUseCase = MakeRegisterStockMovementUseCase()

        const { stock_movement, new_balance } = await registerStockMovementUseCase.execute({
            item_id,
            description: description ? description : undefined,
            quantity,
            operation,
            created_at: created_at ? created_at : undefined,
            unit_cost
        })

        return reply.status(200).send({
            ...stock_movement,
            new_balance
        })

    } catch (err) {

        if (err instanceof Error) {
            // Check for specific errors to return 400 or 409
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
}
