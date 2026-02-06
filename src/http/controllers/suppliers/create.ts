import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateSupplierUseCase } from '@/use-cases/factories/make-create-supplier-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createSupplierBodySchema = z.object({
        name: z.string(),
        document: z.string().nullable().optional(),
        email: z.union([z.string().email(), z.literal(''), z.null(), z.undefined()]),
        phone: z.string().nullable().optional(),
    })

    const body = createSupplierBodySchema.parse(request.body)

    // Transform empty strings to null for cleaner DB
    const document = body.document || null
    const email = body.email || null
    const phone = body.phone || null
    const name = body.name

    const createSupplierUseCase = makeCreateSupplierUseCase()

    await createSupplierUseCase.execute({
        name,
        document,
        email,
        phone,
    })

    return reply.status(201).send()
}
