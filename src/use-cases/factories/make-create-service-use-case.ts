import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { CreateServiceUseCase } from '../services/create-service'

export function makeCreateServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const createServiceUseCase = new CreateServiceUseCase(servicesRepository)

    return createServiceUseCase
}
