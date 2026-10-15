import { MakeClientuseCase } from '@/modules/clients/use-cases/factories/make-client-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { acharClienteComTelefone } from '@/modules/clients/services/telefone-do-cliente'





export async function createClient(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        identification: z.string().nullish(),
        phone: z.string().nullish(),
        email: z.string().nullish(),
        contract: z.boolean().nullish(),
        contact: z.string().nullish(),
        isEnterprise: z.boolean().nullish(),
        // Fase 4 do Mergulho (16:A8): a tela confirma "cadastrar mesmo assim" quando o telefone já é de outro cliente.
        allowDuplicatePhone: z.boolean().nullish(),
    })

    const { name, identification, phone, email, contract, contact, isEnterprise, allowDuplicatePhone } = registerBodySchema.parse(request.body)

    // Fase 4 do Mergulho (16:A8): telefone já usado por outro cliente avisa antes de criar o segundo cadastro.
    if (!allowDuplicatePhone) {
        const outro = await acharClienteComTelefone(prisma as any, phone)
        if (outro) {
            return reply.status(409).send({
                code: 'DUPLICATE_PHONE',
                message: `Já existe o cliente "${outro.name}" com este telefone.`,
                client: outro,
            })
        }
    }

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


