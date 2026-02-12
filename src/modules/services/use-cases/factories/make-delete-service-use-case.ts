import { PrismaServicesRepository } from '@/modules/services/repositories/prisma/prisma-services-repository'
import { DeleteServiceUseCase } from '@/modules/services/use-cases/delete-service'

export function makeDeleteServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const useCase = new DeleteServiceUseCase(servicesRepository)

    return useCase
}
