import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeDeleteSupplierUseCase } from '@/modules/suppliers/use-cases/factories/make-delete-supplier-use-case'

export async function remove(request: FastifyRequest, reply: FastifyReply) {
    const deleteSupplierParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteSupplierParamsSchema.parse(request.params)

    const deleteSupplierUseCase = makeDeleteSupplierUseCase()

    await deleteSupplierUseCase.execute({
        id,
    })

    return reply.status(204).send()
}
