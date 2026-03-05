import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetServiceManagementDataUseCase } from '@/modules/services/use-cases/factories/make-get-service-management-data-use-case'

export async function getServiceManagementData(request: FastifyRequest, reply: FastifyReply) {
    const getServiceQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : undefined),
        year: z.string().optional().transform(y => y ? Number(y) : undefined),
    })

    const { month, year } = getServiceQuerySchema.parse(request.query)
    const date = (month !== undefined && year !== undefined) ? new Date(year, month - 1, 1) : undefined

    let serviceData

    try {
        const getServiceManagementDataUseCase = MakeGetServiceManagementDataUseCase()
        serviceData = await getServiceManagementDataUseCase.execute(date)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(serviceData)
}