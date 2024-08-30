import {FastifyRequest, FastifyReply} from 'fastify'
import {z} from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { MakeSectorUseCase } from '@/use-cases/factories/make-sector-use-case'




export async function createSector (request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        budget: z.number(),
        type: z.string()
    })

    const {name, budget, type} = registerBodySchema.parse(request.body)

    try {
        const sectorUseCase = MakeSectorUseCase()
        await sectorUseCase.execute({
            name,
            budget,
            type
        })
    } catch(err){
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send()
}


