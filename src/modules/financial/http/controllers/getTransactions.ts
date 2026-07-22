import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTransactionsUseCase } from '@/modules/financial/use-cases/factories/make-get-transactions-use-case'
import { z } from 'zod'

export async function getTransactions(request: FastifyRequest, reply: FastifyReply) {

    const getTransactionsParamsSchema = z.object({
        page: z.coerce.number(),
        description: z.string().optional(),
        value: z.coerce.number().optional(),
        sector_id: z.string().optional(),
        account_id: z.union([z.string(), z.array(z.string())]).optional(),
        month: z.coerce.date().optional(),
        status: z.string().optional(),
        toDate: z.string().optional(),
        fromDate: z.string().optional(),
        per_page: z.coerce.number().optional(),
        supplier_id: z.string().optional(),
        type: z.string().optional(),
        sortBy: z.string().optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        checked: z.string().optional()
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
            account_id: query.account_id === 'all' ? undefined : (typeof query.account_id === 'string' && query.account_id.includes(',') ? query.account_id.split(',') : query.account_id),
            status: query.status,
            toDate: query.toDate ? new Date(query.toDate) : undefined,
            fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
            perPage: query.per_page, // Ensure this is passed
            supplier_id: query.supplier_id === 'all' ? undefined : query.supplier_id,
            type: query.type,
            sortBy: query.sortBy,
            sortDirection: query.sortDirection,
            checked: query.checked
        })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send({ transactions })
}


