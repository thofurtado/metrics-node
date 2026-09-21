import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { UpdateCreditCardPurchaseUseCase } from '@/modules/financial/use-cases/update-credit-card-purchase'
import { DeleteCreditCardPurchaseUseCase } from '@/modules/financial/use-cases/delete-credit-card-purchase'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function updateCreditCardPurchase(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        amount: z.number().positive().optional(),
        description: z.string().nullish(),
        sector_id: z.string().uuid().nullish(),
        supplier_id: z.string().uuid().nullish(),
        data_emissao: z.coerce.date().optional(),
        credit_card_id: z.string().uuid().optional(),
    })

    const { id } = paramsSchema.parse(request.params)
    const body = bodySchema.parse(request.body)

    try {
        const { transaction } = await new UpdateCreditCardPurchaseUseCase().execute({ id, ...body })
        return reply.status(200).send({ transaction })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}

export async function deleteCreditCardPurchase(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({ scope: z.enum(['one', 'forward', 'all']).default('one') })

    const { id } = paramsSchema.parse(request.params)
    const { scope } = querySchema.parse(request.query)

    try {
        const result = await new DeleteCreditCardPurchaseUseCase().execute({ id, scope })
        return reply.status(200).send(result)
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
