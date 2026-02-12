import { PrismaServicesRepository } from '@/modules/services/repositories/prisma/prisma-services-repository'
import { CreateServiceUseCase } from '@/modules/services/use-cases/create-service'

export function makeCreateServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const createServiceUseCase = new CreateServiceUseCase(servicesRepository)

    return createServiceUseCase
}
