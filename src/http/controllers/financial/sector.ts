import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { MakeSectorUseCase } from '@/use-cases/factories/make-sector-use-case'




export async function createSector(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        budget: z.number().nullable().optional(),
        type: z.string()
    })

    const { name, budget, type } = registerBodySchema.parse(request.body)

    try {
        const sectorUseCase = MakeSectorUseCase()
        const { sector } = await sectorUseCase.execute({
            name,
            budget: budget ?? undefined,
            type
        })
        return reply.status(201).send(sector)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
}


