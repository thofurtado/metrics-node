import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { UpdateServiceUseCase } from '../services/update-service'

export function makeUpdateServiceUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const useCase = new UpdateServiceUseCase(servicesRepository)

    return useCase
}
