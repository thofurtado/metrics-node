import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetGeneralBalanceUseCase } from '@/use-cases/factories/make-get-general-balance'

export async function getGeneralBalance(request: FastifyRequest, reply: FastifyReply) {
    let genetalBalance
    try {
        const getGeneralBalance = MakeGetGeneralBalanceUseCase()
        genetalBalance = await getGeneralBalance.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(genetalBalance)
}


