import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { DeleteServiceUseCase } from '../services/delete-service'

export function makeDeleteServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const useCase = new DeleteServiceUseCase(servicesRepository)

    return useCase
}
