import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTransactionsUseCase } from '@/use-cases/factories/make-get-transactions-use-case'
import { z } from 'zod'

export async function getTransactions(request: FastifyRequest, reply: FastifyReply) {

    const getTransactionsParamsSchema = z.object({
        page:z.string(),
        description: z.string().nullish(),
        value: z.string().nullish(),
        sector_id: z.string().nullish(),
        account_id: z.string().nullish(),
        month: z.date().nullish(),
    })
    const { page, description, value, sector_id, account_id, month  } = getTransactionsParamsSchema.parse(request.query)
    let transactions
    console.log('Descrição: '+description)
    console.log('Valor: '+ value)
    console.log('Setor: '+sector_id)
    console.log('Account*************: '+account_id)
    try {
        const getTransactionUseCase = MakeGetTransactionsUseCase()
        transactions = await getTransactionUseCase.execute({
            pageIndex: parseInt(page),
            description: description ? description : undefined,
            value: value ? Number(value) : undefined,
            month: month ? month : new Date(),
            sector_id: sector_id ? sector_id : 'all',
            account_id: account_id ? account_id : 'all',
        })
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send({transactions})
}


