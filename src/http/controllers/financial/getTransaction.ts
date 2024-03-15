import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTransactionsUseCase } from '@/use-cases/factories/make-get-transactions-use-case'

export async function getTransaction(request: FastifyRequest, reply: FastifyReply) {
    let transactions
    try {
        const getTransactionUseCase = MakeGetTransactionsUseCase()
        transactions = await getTransactionUseCase.execute()
    } catch (err) {
        return reply.status(409).send()
        throw err
    }
    return reply.status(200).send(transactions)
}


