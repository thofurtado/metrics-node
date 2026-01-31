import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { MakeSectorUseCase } from '@/use-cases/factories/make-sector-use-case'




export async function createSector(request: FastifyRequest, reply: FastifyReply) {

    try {
        // Log payload for debugging
        console.log('[CreateSector] Payload:', JSON.stringify(request.body, null, 2))

        const registerBodySchema = z.object({
            name: z.string(),
            budget: z.number().nullable().optional(),
            type: z.string()
        })

        const { name, budget, type } = registerBodySchema.parse(request.body)

        const sectorUseCase = MakeSectorUseCase()
        const { sector } = await sectorUseCase.execute({
            name,
            budget: budget ?? undefined,
            type
        })
        return reply.status(201).send(sector)
    } catch (err) {
        console.error('[CreateSector] Error:', err)
        if (err instanceof z.ZodError) {
            return reply.status(400).send({ message: 'Validation error', issues: err.format() })
        }
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}


