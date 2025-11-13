import { ServiceManagementRepository } from '@/repositories/service-management-repository.ts'

interface GetServiceManagementDataUseCaseResponse {
    serviceData: {
        totalTreatments: number
        completedTreatments: number
        inWorkbench: number
        externalOpen: number
        averageTreatmentTime: number
    }
}

export class GetServiceManagementDataUseCase {
    constructor(
        private serviceManagementRepository: ServiceManagementRepository
    ) { }

    async execute(): Promise<GetServiceManagementDataUseCaseResponse> {
        const serviceData = await this.serviceManagementRepository.getServiceManagementData()

        return { serviceData }
    }
}