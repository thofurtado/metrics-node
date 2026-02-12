// controllers/get-service-management-data.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetServiceManagementDataUseCase } from '@/modules/services/use-cases/factories/make-get-service-management-data-use-case'

export async function getServiceManagementData(request: FastifyRequest, reply: FastifyReply) {
    let serviceData

    try {
        const getServiceManagementDataUseCase = MakeGetServiceManagementDataUseCase()
        serviceData = await getServiceManagementDataUseCase.execute()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }

    return reply.status(200).send(serviceData)
}