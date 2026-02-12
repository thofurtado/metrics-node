import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCheckProductCodeAvailabilityUseCase } from '@/modules/products/use-cases/factories/make-check-product-code-availability-use-case'

export async function checkCode(request: FastifyRequest, reply: FastifyReply) {
    const checkCodeQuerySchema = z.object({
        code: z.coerce.number()
    })

    const { code } = checkCodeQuerySchema.parse(request.query)

    const checkProductCodeAvailabilityUseCase = makeCheckProductCodeAvailabilityUseCase()

    const { available } = await checkProductCodeAvailabilityUseCase.execute({ code })

    return reply.status(200).send({ available })
}
