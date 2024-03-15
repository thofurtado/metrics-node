import { PaymentsRepository } from '@/repositories/payments-repository'
import { Payment } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { AccountsRepository } from '@/repositories/accounts-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface PaymentUseCaseRequest {
    name: string,
    installment_limit: number,
    in_sight: boolean,
    account_id?: string
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
        name,installment_limit,in_sight, account_id
    }: PaymentUseCaseRequest): Promise<PaymentUseCaseResponse> {

        const sameNamePayment = await this.paymentsRepository.findByName(name)
        if(sameNamePayment)
            throw new ThisNameAlreadyExistsError()

        if(installment_limit <= 0 )
            throw new OnlyNaturalNumbersError()
        let findedAccount
        if(account_id)
            findedAccount = await this.accountsRepository.findById(account_id)
        if(!findedAccount)
            throw new ResourceNotFoundError()
        const payment = await this.paymentsRepository.create({
            name,
            installment_limit,
            in_sight,
            account_id
        })
        return {
            payment
        }
    }
}

