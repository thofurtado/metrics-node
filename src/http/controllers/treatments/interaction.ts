import { MakeInteractionUseCase } from '@/use-cases/factories/make-interaction-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createInteraction(request: FastifyRequest, reply: FastifyReply) {


    const createInteractionParams = z.object({
        id: z.string().uuid()
    })
    const createInteractionBodySchema = z.object({
        date: z.coerce.date().nullish(),
        description: z.string()
    })


    const { date, description } = createInteractionBodySchema.parse(request.body)
    const { id }  = createInteractionParams.parse(request.params)


    let interaction
    try {

        const interactionUseCase = MakeInteractionUseCase()

        interaction = await interactionUseCase.execute({
            user_id: request.user.sub,
            treatment_id: id,
            date: date ? date : new Date(),
            description
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(interaction)
}


