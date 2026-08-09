import { MakeAccountUseCase } from '@/modules/financial/use-cases/factories/make-account-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createAccount(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        balance: z.number(),
        description: z.string().nullish(),
        goal: z.number().nullish(),
        is_transit: z.boolean().optional().default(false)
    })

    const { name, description, balance, goal, is_transit } = registerBodySchema.parse(request.body)
    let account
    try {

        const accountUseCase = MakeAccountUseCase()

        if (is_transit) {
            const { prisma } = require('@/lib/prisma')
            const existingTransit = await prisma.account.findFirst({ where: { is_transit: true } })
            if (existingTransit) {
                return reply.status(400).send({ message: 'Já existe uma conta transitória configurada. Apenas uma é permitida.' })
            }
        }

        account = await accountUseCase.execute({
            name,
            description: description || null,
            balance,
            goal: goal || null,
            is_transit
        })
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(account)
}


