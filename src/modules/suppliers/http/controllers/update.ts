import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeUpdateSupplierUseCase } from '@/modules/suppliers/use-cases/factories/make-update-supplier-use-case'

export async function update(request: FastifyRequest, reply: FastifyReply) {
    const updateSupplierBodySchema = z.object({
        name: z.string().optional(),
        document: z.string().nullable().optional(),
        email: z.union([z.string().email(), z.literal(''), z.null(), z.undefined()]),
        phone: z.string().nullable().optional(),
    })

    const updateSupplierParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = updateSupplierParamsSchema.parse(request.params)
    const body = updateSupplierBodySchema.parse(request.body)

    // Transform empty strings to null or undefined (if not provided)
    // IMPORTANT: For update, undefined means "do not update". null means "clear value".
    // If body.document is undefined -> do not update.
    // If body.document is "" or null -> update to null.

    const document = body.document === '' ? null : body.document
    const email = body.email === '' ? null : body.email
    const phone = body.phone === '' ? null : body.phone
    const name = body.name

    const updateSupplierUseCase = makeUpdateSupplierUseCase()

    await updateSupplierUseCase.execute({
        id,
        name,
        document,
        email,
        phone,
    })

    return reply.status(200).send()
}
