import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetItemsUseCase } from '@/use-cases/factories/make-get-items-use-case'

export async function getItems(request: FastifyRequest, reply: FastifyReply) {
    let items
    try {
        const getItemUseCase = MakeGetItemsUseCase()
        items = await getItemUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(items)
}


