// use-cases/factories/make-get-service-management-data-use-case.ts
import { PrismaServiceManagementRepository } from '@/modules/services/repositories/prisma/prisma-service-management-repository'
import { GetServiceManagementDataUseCase } from '@/modules/services/use-cases/get-service-management-data'

export function MakeGetServiceManagementDataUseCase() {
    const serviceManagementRepository = new PrismaServiceManagementRepository()
    const getServiceManagementDataUseCase = new GetServiceManagementDataUseCase(serviceManagementRepository)
    return getServiceManagementDataUseCase
}