import { MakeAccountUseCase } from '@/use-cases/factories/make-account-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createAccount(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        balance: z.number(),
        description: z.string().nullish(),
        goal: z.number().nullish()
    })

    const { name, description, balance, goal } = registerBodySchema.parse(request.body)
    let account
    try {

        const accountUseCase = MakeAccountUseCase()

        account = await accountUseCase.execute({
            name,
            description: description || null,
            balance,
            goal: goal || null
        })
    } catch (err) {

        return reply.status(409).send()

        throw err
    }
    return reply.status(200).send(account)
}


