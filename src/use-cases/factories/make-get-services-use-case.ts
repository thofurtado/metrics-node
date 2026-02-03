import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { GetServicesUseCase } from '../services/get-services'

export function makeGetServicesUseCase() {
    const servicesRepository = new PrismaServicesRepository()
    const getServicesUseCase = new GetServicesUseCase(servicesRepository)

    return getServicesUseCase
}
