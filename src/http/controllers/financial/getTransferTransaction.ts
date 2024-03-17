import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTransferTransactionsUseCase } from '@/use-cases/factories/make-get-transfer-transactions-use-case'

export async function getTransferTransaction(request: FastifyRequest, reply: FastifyReply) {
    let transactions
    try {
        const getTransferTransactionUseCase = MakeGetTransferTransactionsUseCase()
        transactions = await getTransferTransactionUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(transactions)
}


