import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTransactionsUseCase } from '@/modules/financial/use-cases/factories/make-get-transactions-use-case'
import { z } from 'zod'

export async function getTransactions(request: FastifyRequest, reply: FastifyReply) {

    const getTransactionsParamsSchema = z.object({
        page: z.coerce.number(),
        description: z.string().optional(),
        value: z.coerce.number().optional(),
        sector_id: z.string().optional(),
        account_id: z.string().optional(),
        month: z.coerce.date().optional(),
        status: z.string().optional(),
        toDate: z.string().optional(),
        per_page: z.coerce.number().optional(),
        supplier_id: z.string().optional(),
        type: z.string().optional(),
    })

    const query = getTransactionsParamsSchema.parse(request.query)

    let transactions
    try {
        const getTransactionUseCase = MakeGetTransactionsUseCase()
        transactions = await getTransactionUseCase.execute({
            pageIndex: query.page,
            description: query.description,
            value: query.value,
            month: query.month || new Date(),
            sector_id: query.sector_id === 'all' ? undefined : query.sector_id,
            account_id: query.account_id === 'all' ? undefined : query.account_id,
            status: query.status,
            toDate: query.toDate ? new Date(query.toDate) : undefined,
            perPage: query.per_page, // Ensure this is passed
            supplier_id: query.supplier_id === 'all' ? undefined : query.supplier_id,
            type: query.type
        })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send({ transactions })
}


