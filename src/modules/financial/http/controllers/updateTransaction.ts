import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeUpdateTransactionUseCase } from '@/modules/financial/use-cases/factories/make-update-transaction-use-case'

export async function updateTransaction(request: FastifyRequest, reply: FastifyReply) {
    const updateParamsSchema = z.object({
        id: z.string(),
    })

    const updateBodySchema = z.object({
        amount: z.number().nullish(),
        account_id: z.string().nullish(),
        data_vencimento: z.coerce.date().nullish(),
        data_emissao: z.coerce.date().nullish(),
        sector_id: z.string().nullish(),
        description: z.string().nullish(),
        confirmed: z.boolean().nullish(),
        supplier_id: z.string().nullish(),
        payment_method: z.string().nullish(),
    })

    const { id } = updateParamsSchema.parse(request.params)
    const {
        amount,
        account_id,
        data_vencimento,
        data_emissao,
        sector_id,
        description,
        confirmed,
        supplier_id,
        payment_method
    } = updateBodySchema.parse(request.body)

    try {
        const updateTransactionUseCase = MakeUpdateTransactionUseCase()

        const { transaction } = await updateTransactionUseCase.execute({
            id,
            amount: amount || undefined,
            account_id: account_id,
            confirmed: confirmed,
            data_vencimento: data_vencimento,
            data_emissao: data_emissao,
            sector_id: sector_id,
            description: description,
            supplier_id: supplier_id,
            payment_method: payment_method
        })

        return reply.status(200).send({ transaction })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
