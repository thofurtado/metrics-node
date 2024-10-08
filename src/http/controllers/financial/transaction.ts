
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeTransactionUseCase } from '../../../use-cases/factories/make-transaction-use-case'




export async function createTransaction(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        operation: z.string(),
        amount: z.number(),
        account_id: z.string(),
        date: z.coerce.date().nullish(),
        sector_id: z.string().nullish(),
        description: z.string().nullish(),
        confirmed: z.boolean().nullish(),
        destination_account_id: z.string().nullish()
    })
    console.log(request.body)
    const { operation, amount, account_id, date, sector_id, description, confirmed, destination_account_id } = registerBodySchema.parse(request.body)
    console.log('aqui')
    let transaction
    try {

        const transactionUseCase = MakeTransactionUseCase()

        transaction = await transactionUseCase.execute({
            operation,
            amount,
            account_id,
            confirmed: confirmed || null,
            date: date || null,
            sector_id: sector_id || null,
            description: description || null,
            destination_account_id: destination_account_id || null
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err

    }
    return reply.status(200).send(transaction)
}


