import { MakeClientuseCase } from '@/modules/clients/use-cases/factories/make-client-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createClient(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        identification: z.string().nullish(),
        phone: z.string().nullish(),
        email: z.string().nullish(),
        contract: z.boolean().nullish(),
        contact: z.string().nullish(),
        isEnterprise: z.boolean().nullish(),
    })

    const { name, identification, phone, email, contract, contact, isEnterprise } = registerBodySchema.parse(request.body)
    let client
    try {

        const clientUseCase = MakeClientuseCase()

        client = await clientUseCase.execute({
            name,
            identification: identification ? identification : undefined,
            phone: phone ? phone : undefined,
            email: email ? email : undefined,
            contract: contract ? contract : false,
            contact: contact ? contact : undefined,
            isEnterprise: isEnterprise ? isEnterprise : false
        })
    } catch (err) {

        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send(client)
}


