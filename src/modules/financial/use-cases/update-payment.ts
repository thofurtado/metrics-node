import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'
import { Payment } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'

interface UpdatePaymentUseCaseRequest {
    id: string
    name?: string
    installment_limit?: number
    in_sight?: boolean
    show_in_menu?: boolean
    active_for_out?: boolean
    active_for_in?: boolean
    account_id?: string
}

interface UpdatePaymentUseCaseResponse {
    payment: Payment
}

export class UpdatePaymentUseCase {
    constructor(
        private paymentsRepository: PaymentsRepository,
        private accountsRepository: AccountsRepository
    ) { }

    async execute({
        id,
        name,
        installment_limit,
        in_sight,
        show_in_menu,
        active_for_out,
        active_for_in,
        account_id
    }: UpdatePaymentUseCaseRequest): Promise<any> {
        const payment = await this.paymentsRepository.findById(id)

        if (!payment) {
            throw new ResourceNotFoundError()
        }

        if (account_id) {
            const account = await this.accountsRepository.findById(account_id)
            if (!account) {
                throw new ResourceNotFoundError()
            }
        }

        const isMenuOut = show_in_menu !== undefined ? show_in_menu : active_for_out;
        const updatedPayment = await this.paymentsRepository.update(id, {
            name,
            installment_limit,
            in_sight,
            active_for_out: isMenuOut,
            active_for_in,
            account_id
        })

        return {
            payment: updatedPayment,
        }
    }
}
