import { FastifyRequest, FastifyReply } from 'fastify'

import { MakeGetStocksUseCase } from '@/use-cases/factories/make-get-item-stocks-use-case'
import { z } from 'zod'

export async function getItemHistory(request: FastifyRequest, reply: FastifyReply) {
    const getItemStocksParamsSchema = z.object({
        id:z.string().uuid()
    })
    const {id} = getItemStocksParamsSchema.parse(request.params)
    let itemStocks
    try {
        const getItemUseCase = MakeGetStocksUseCase()
        itemStocks = await getItemUseCase.execute(id)
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(itemStocks)
}


