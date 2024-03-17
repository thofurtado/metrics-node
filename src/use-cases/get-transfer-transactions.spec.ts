import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryTransferTransactionsRepository } from '@/repositories/in-memory/in-memory-transfer-transactions-repository'
import { GetTransferTransactionsUseCase } from './get-transfer-transactions'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'



let transferTransactionsRepository: InMemoryTransferTransactionsRepository
let getTransferTransactionsUseCase: GetTransferTransactionsUseCase
let accountsRepository: InMemoryAccountsRepository
let transactionsRepository: InMemoryTransactionsRepository

describe('Get TransferTransactions Use Case', () => {
    beforeEach(() => {
        transferTransactionsRepository = new InMemoryTransferTransactionsRepository()
        accountsRepository = new InMemoryAccountsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()
        getTransferTransactionsUseCase = new GetTransferTransactionsUseCase(transferTransactionsRepository)
    })
    it('should be able to get transferTransactions', async () => {
        const account = await accountsRepository.create({
            name: 'test',
            balance: 0
        })
        const transaction = await transactionsRepository.create({
            account_id: account.id,
            operation: 'income',
            amount: 10
        })
        await transferTransactionsRepository.create({
            destination_account_id: account.id,
            transaction_id: transaction.id
        })
        await transferTransactionsRepository.create({
            destination_account_id: account.id,
            transaction_id: transaction.id
        })
        await transferTransactionsRepository.create({
            destination_account_id: account.id,
            transaction_id: transaction.id
        })

        const transferTransactions = await getTransferTransactionsUseCase.execute()

        expect(transferTransactions.transferTransactions?.length).toEqual(3)
    })

})
