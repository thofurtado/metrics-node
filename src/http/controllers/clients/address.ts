import { MakeAddressuseCase } from '@/use-cases/factories/make-address-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createAddress(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({

        client_id: z.string(),
        street: z.string(),
        number: z.number(),
        neighborhood: z.string(),
        city: z.string(),
        state: z.string(),
        zipcode: z.number().nullish()
    })

    const { client_id, street, number, neighborhood, city, state, zipcode } = registerBodySchema.parse(request.body)
    let address
    try {

        const addressUseCase = MakeAddressuseCase()

        address = await addressUseCase.execute({
            client_id, street, number, neighborhood, city, state, zipcode: zipcode ? zipcode : 0
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(address)
}


