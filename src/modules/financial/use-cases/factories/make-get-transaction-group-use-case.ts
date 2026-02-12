import { GetTransactionGroupUseCase } from '@/modules/financial/use-cases/get-transaction-group'

export function MakeGetTransactionGroupUseCase() {
    return new GetTransactionGroupUseCase()
}
