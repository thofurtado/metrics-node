import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeUpdatePaymentUseCase } from '@/modules/financial/use-cases/factories/make-update-payment-use-case'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function updatePayment(request: FastifyRequest, reply: FastifyReply) {
    const updatePaymentParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updatePaymentBodySchema = z.object({
        name: z.string().optional(),
        installment_limit: z.number().optional(),
        in_sight: z.boolean().optional(),
        show_in_menu: z.boolean().optional(),
        active_for_out: z.boolean().optional(),
        active_for_in: z.boolean().optional(),
        account_id: z.string().uuid().optional().nullable(),
    })

    const { id } = updatePaymentParamsSchema.parse(request.params)
    const { name, installment_limit, in_sight,
            show_in_menu, active_for_out, active_for_in, account_id } = updatePaymentBodySchema.parse(request.body)

    try {
        const updatePaymentUseCase = MakeUpdatePaymentUseCase()

        await updatePaymentUseCase.execute({
            id,
            name,
            installment_limit,
            in_sight,
            show_in_menu: show_in_menu !== undefined ? show_in_menu : active_for_out,
            active_for_out: show_in_menu !== undefined ? show_in_menu : active_for_out,
            active_for_in,
            account_id: account_id || undefined,
        })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        throw err
    }

    return reply.status(200).send()
}
