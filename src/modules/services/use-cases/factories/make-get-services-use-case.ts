import { PrismaServicesRepository } from '@/modules/services/repositories/prisma/prisma-services-repository'
import { GetServicesUseCase } from '@/modules/services/use-cases/get-services'

export function makeGetServicesUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const getServicesUseCase = new GetServicesUseCase(servicesRepository)

    return getServicesUseCase
}
