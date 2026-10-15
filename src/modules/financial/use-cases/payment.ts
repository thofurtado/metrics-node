import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'
import { Payment } from '@prisma/client'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { KIND_PLATAFORMA } from '@/modules/cashier/services/plataformas'

interface PaymentUseCaseRequest {
    name: string,
    installment_limit: number,
    in_sight: boolean,
    account_id?: string
    /** null = forma comum; 'PLATAFORMA' = paga no app do iFood/99 (15/10/2026) */
    kind?: string | null
}
interface PaymentUseCaseResponse {
    payment: Payment
}
export class PaymentUseCase {

    constructor(
        private paymentsRepository: PaymentsRepository,
        private accountsRepository: AccountsRepository
    ) { }
    async execute({
        name,installment_limit,in_sight, account_id, kind
    }: PaymentUseCaseRequest): Promise<PaymentUseCaseResponse> {

        const sameNamePayment = await this.paymentsRepository.findByName(name)
        if(sameNamePayment)
            throw new ThisNameAlreadyExistsError()

        if(installment_limit <= 0 )
            throw new OnlyNaturalNumbersError()
        let findedAccount
        if(account_id)
            findedAccount = await this.accountsRepository.findById(account_id)
        // A forma Plataforma não precisa de conta: o repasse vai para a conta da plataforma (cadastro de plataformas)
        const ehPlataforma = kind === KIND_PLATAFORMA
        if(!findedAccount && !(ehPlataforma && !account_id))
            throw new ResourceNotFoundError()
        const payment = await this.paymentsRepository.create({
            name,
            installment_limit,
            in_sight,
            account_id: account_id || null,
            kind: ehPlataforma ? KIND_PLATAFORMA : null,
        })
        return {
            payment
        }
    }
}

