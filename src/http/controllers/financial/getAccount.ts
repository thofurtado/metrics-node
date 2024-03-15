import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetAccountsUseCase } from '@/use-cases/factories/make-get-accounts-use-case'

export async function getAccount(request: FastifyRequest, reply: FastifyReply) {
    let accounts
    try {
        const getAccountUseCase = MakeGetAccountsUseCase()
        accounts = await getAccountUseCase.execute()
    } catch (err) {
        return reply.status(409).send()
        throw err
    }
    return reply.status(200).send(accounts)
}


