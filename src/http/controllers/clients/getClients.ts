import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetClientsUseCase } from '@/use-cases/factories/make-get-clients-use-case'

export async function getClient(request: FastifyRequest, reply: FastifyReply) {
    let clients
    try {
        const getClientUseCase = MakeGetClientsUseCase()
        clients = await getClientUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(clients)
}


