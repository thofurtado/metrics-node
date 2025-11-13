// repositories/service-management-repository.ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface ServiceManagementData {
    totalTreatments: number
    completedTreatments: number
    inWorkbench: number
    externalOpen: number
    averageTreatmentTime: number // em minutos
}

export interface ServiceManagementRepository {
    getServiceManagementData(): Promise<ServiceManagementData>
}