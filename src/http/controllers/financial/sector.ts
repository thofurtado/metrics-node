import {FastifyRequest, FastifyReply} from 'fastify'
import {z} from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { MakeSectorUseCase } from '@/use-cases/factories/make-sector-use-case'




export async function createSector (request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        budget: z.number(),
    })

    const {name, budget} = registerBodySchema.parse(request.body)

    try {
        const sectorUseCase = MakeSectorUseCase()
        await sectorUseCase.execute({
            name,
            budget,
        })
    } catch(err){
        if(err instanceof UserAlreadyExistsError){
            return reply.status(409).send({message: err.message})
        }
        throw err
    }
    return reply.status(200).send()
}


