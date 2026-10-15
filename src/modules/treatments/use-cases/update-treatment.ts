import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'
import { Treatment } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'


interface UpdateTreatmentUseCaseRequest {
    id: string,
    opening_date?: Date,
    ending_date?: Date,
    contact?: string,
    user_id?: string,
    client_id?: string,
    equipment_id?: string,
    request?: string,
    status?: string,
    amount?: number,
    observations?: string,
}

interface UpdateTreatmentUseCaseResponse {
    treatment: Treatment
}

/** Situações de O.S. finalizada ("finished" é o nome antigo de "resolved"). */
const FINALIZADA = ['resolved', 'finished']

interface FinishTreatment {
    execute(request: { treatment_id: string }): Promise<unknown>
}

interface ReopenTreatment {
    execute(request: { treatment_id: string; nextStatus?: string }): Promise<unknown>
}

export class UpdateTreatmentUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository,
        private finishTreatment?: FinishTreatment,
        private reopenTreatment?: ReopenTreatment,
    ) { }
    async execute({
        id,
        opening_date, ending_date, contact, user_id, client_id, equipment_id, request,status, observations
    }: UpdateTreatmentUseCaseRequest): Promise<UpdateTreatmentUseCaseResponse> {

        // Fase 1 do Mergulho (16:A2): antes, trocar a situação aqui só mudava o texto. Cancelar (ou tirar de "resolvido")
        // uma O.S. finalizada deixava as peças fora do estoque e os recebimentos no caixa e no painel; e marcar "resolvido"
        // sem passar pelo fechamento não baixava o estoque. Agora a mudança que entra ou sai de "finalizada" passa pela
        // mesma regra do fechamento (finish) e da reabertura (reopen), que mexem no estoque e no financeiro.
        let statusToWrite = status
        if (status) {
            const current = await this.treatmentsRepository.findById(id)
            if (!current) {
                throw new ResourceNotFoundError()
            }
            const wasFinished = FINALIZADA.includes(current.status)
            const willBeFinished = FINALIZADA.includes(status)

            if (wasFinished && !willBeFinished) {
                if (!this.reopenTreatment) {
                    throw new Error('Esta O.S. está finalizada. Use "Reabrir" para desfazer o fechamento antes de mudar a situação.')
                }
                await this.reopenTreatment.execute({ treatment_id: id, nextStatus: status })
                statusToWrite = undefined
            } else if (!wasFinished && willBeFinished) {
                if (!this.finishTreatment) {
                    throw new Error('Para resolver a O.S. use a finalização, que baixa o estoque e registra os recebimentos.')
                }
                await this.finishTreatment.execute({ treatment_id: id })
                statusToWrite = undefined
            }
        }

        const treatment = await this.treatmentsRepository.update(id, {
            opening_date, ending_date, contact, user_id, client_id, equipment_id, request, status: statusToWrite, observations
        })

        return {
            treatment
        }
    }
}
