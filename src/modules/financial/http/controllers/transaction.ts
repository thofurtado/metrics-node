
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeTransactionUseCase } from '@/modules/financial/use-cases/factories/make-transaction-use-case'




export async function createTransaction(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        operation: z.string(),
        amount: z.number(),
        account_id: z.string(),
        data_vencimento: z.coerce.date().nullish(),
        data_emissao: z.coerce.date().nullish(),
        sector_id: z.string().nullish(),
        description: z.string().nullish(),
        confirmed: z.boolean().nullish(),
        destination_account_id: z.string().nullish(),
        supplier_id: z.string().nullish(),
        payment_method: z.string().nullish(),
        installments_count: z.number().nullish(),
        interval_frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).nullish(),
        custom_installments: z.array(z.object({
            data_vencimento: z.coerce.date(),
            data_emissao: z.coerce.date().optional(),
            amount: z.number()
        })).nullish(),
        interest: z.number().nullish(),
        fine: z.number().nullish(),
        discount: z.number().nullish(),
        totalValue: z.number().nullish(),
        credit_card_id: z.string().uuid().nullish(),
    })

    // console.log('Payload Recebido:', JSON.stringify(request.body, null, 2))

    const {
        operation,
        amount,
        account_id,
        data_vencimento,
        data_emissao,
        sector_id,
        description,
        confirmed,
        destination_account_id,
        supplier_id,
        payment_method,
        installments_count,
        interval_frequency,
        custom_installments,
        interest,
        fine,
        discount,
        totalValue,
        credit_card_id,
    } = registerBodySchema.parse(request.body)

    let transaction
    try {

        const transactionUseCase = MakeTransactionUseCase()

        transaction = await transactionUseCase.execute({
            operation,
            amount,
            account_id,
            confirmed: confirmed || null,
            data_vencimento: data_vencimento || null,
            data_emissao: data_emissao || null,
            sector_id: sector_id || null,
            description: description || null,
            destination_account_id: destination_account_id || null,
            supplier_id: supplier_id || null,
            payment_method: payment_method || null,
            installments_count: installments_count || undefined,
            interval_frequency: interval_frequency || undefined,
            custom_installments: custom_installments || undefined,
            interest: interest || null,
            fine: fine || null,
            discount: discount || null,
            totalValue: totalValue || null,
            credit_card_id: credit_card_id || null,
        })
    } catch (err) {

        if (err instanceof Error) {
            console.error(err)
            return reply.status(409).send({ message: err.message })
        }

        throw err

    }
    return reply.status(200).send(transaction)
}


