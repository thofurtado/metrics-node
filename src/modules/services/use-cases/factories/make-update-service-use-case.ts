import { PrismaServicesRepository } from '@/modules/services/repositories/prisma/prisma-services-repository'
import { UpdateServiceUseCase } from '@/modules/services/use-cases/update-service'

export function makeUpdateServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const useCase = new UpdateServiceUseCase(servicesRepository)

    return useCase
}
