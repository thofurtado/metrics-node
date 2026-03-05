import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'



interface GetMonthTreatmentsAmountUseCaseResponse {
    amount: number,
    diffFromLastMonth: number
}
export class GetMonthTreatmentsAmountUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute(date?: Date): Promise<GetMonthTreatmentsAmountUseCaseResponse> {

        const metrics = await this.treatmentsRepository.getMonthTreatmentsAmount(date)


        return metrics

    }
}

