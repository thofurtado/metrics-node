import { GetTransactionGroupUseCase } from '../get-transaction-group'

export function MakeGetTransactionGroupUseCase() {
    return new GetTransactionGroupUseCase()
}
