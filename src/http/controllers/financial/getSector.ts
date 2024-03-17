import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetSectorsUseCase } from '@/use-cases/factories/make-get-sectors-use-case'

export async function getSector(request: FastifyRequest, reply: FastifyReply) {
    let sectors
    try {
        const getSectorUseCase = MakeGetSectorsUseCase()
        sectors = await getSectorUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(sectors)
}


