import { MakeClientuseCase } from '@/use-cases/factories/make-client-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createClient(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        identification: z.string(),
        phone: z.string(),
        email: z.string(),
        contract: z.boolean().nullish(),
    })

    const { name, identification, phone, email,contract } = registerBodySchema.parse(request.body)
    let client
    try {

        const clientUseCase = MakeClientuseCase()

        client = await clientUseCase.execute({
            name,
            identification,
            phone,
            email,
            contract: contract ? contract : false
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(client)
}


