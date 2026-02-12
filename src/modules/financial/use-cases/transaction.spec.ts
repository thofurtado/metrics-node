import { expect, describe, it, beforeEach } from 'vitest'
import { TransactionUseCase } from '@/modules/financial/use-cases/transaction'
import { InMemoryTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transactions-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { InMemoryAccountsRepository } from '@/modules/financial/repositories/in-memory/in-memory-accounts-repository'
import { InMemoryTransferTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transfer-transactions-repository'


let transactionsRepository: InMemoryTransactionsRepository
let accountsRepository: InMemoryAccountsRepository
let transferTransactionsRepository: InMemoryTransferTransactionsRepository
let transactionUseCase: TransactionUseCase


describe('Transaction Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()
        transferTransactionsRepository = new InMemoryTransferTransactionsRepository()
        transactionUseCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository)
    })
    it('should be able to create transaction', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            balance: 0
        })
        const { transaction } = await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: account.id,
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })
        expect(transaction.id).toEqual(expect.any(String))
    })
    it('should be able to create transaction without a date', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            balance: 0
        })
        const { transaction } = await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: account.id,
            date: null,
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })
        expect(transaction.id).toEqual(expect.any(String))
    })
    it('should not be able to create transaction with a invalid account', async () => {

        await expect(transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: 'account.id',
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })).rejects.toBeInstanceOf(ResourceNotFoundError)

    })
    it('should not be able to create transaction with no account', async () => {

        await expect(transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })).rejects.toBeInstanceOf(ResourceNotFoundError)

    })
    it('should not be able to create transaction if the operation is rather than income or expense or transfer', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            balance: 0
        })
        await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: account.id,
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: true
        })
        await transactionUseCase.execute({
            operation: 'expense',
            amount: 75,
            account_id: account.id,
            date: new Date(),
            sector_id: 'sector-transporte',
            description: 'Troca da camara do pneu',
            confirmed: true
        })


        await expect(transactionUseCase.execute({
            operation: 'entry',
            amount: 50,
            account_id: account.id,
            date: new Date(),
            description: 'Visita minima',
            confirmed: true
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able change account balance if transition its not confirmed', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-1',
            balance: 30
        })
        await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: false
        })
        await transactionUseCase.execute({
            operation: 'expense',
            amount: 100,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Mercado',
            confirmed: false
        })

        expect(conta1).toHaveProperty('balance', 100)
        expect(conta2).toHaveProperty('balance', 30)
    })

    it('should be able to create a transfer transaction register when operation is transfer and alter balance in account', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-2',
            balance: 200
        })
        const transaction = await transactionUseCase.execute({
            operation: 'transfer',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-transporte',
            confirmed: true,
            destination_account_id: conta2.id
        })


        expect(conta1).toHaveProperty('balance', 50)
        expect(conta2).toHaveProperty('balance', 250)
        expect(transaction.transaction.id).toEqual(expect.any(String))
    })
    it('should not be able to alter account balance in transfer if its not confirmed', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-2',
            balance: 200
        })
        const transaction = await transactionUseCase.execute({
            operation: 'transfer',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-transporte',
            confirmed: false,
            destination_account_id: conta2.id
        })
        expect(conta1).toHaveProperty('balance', 50)
        expect(conta2).toHaveProperty('balance', 250)
        expect(transaction.transaction.id).toEqual(expect.any(String))
    })

    // --- INSTALLMENTS TESTS ---

    it('should split amount correctly across installments (Cenário A: 100/3)', async () => {
        const account = await accountsRepository.create({ name: 'Conta Teste', balance: 1000 })

        // Execute with 100 in 3 installments
        const { transaction } = await transactionUseCase.execute({
            operation: 'expense',
            amount: 100,
            account_id: account.id,
            date: new Date('2024-01-01'),
            confirmed: true,
            installments_count: 3,
            interval_frequency: 'MONTHLY'
        })

        // 1. Check generated transactions in repository
        // The first transaction is returned. Use repo to find others.
        // InMemory repo unfortunately typically stores in an array. Let's inspect `transactionsRepository.items`.
        // Assuming `items` is public in InMemoryTransactionsRepository (it usually is in this pattern).
        const allTransactions = transactionsRepository.items;

        // Expect 3 transactions total
        expect(allTransactions).toHaveLength(3)

        // 2. Sort by date/creation to identify order
        const sorted = allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

        // 3. Verify Amounts
        // 100 / 3 = 33.33 * 3 = 99.99. Remainder 0.01.
        // Logic implemented: Remainder added to FIRST installment.
        // Expect: 33.34, 33.33, 33.33

        const first = sorted[0]
        const second = sorted[1]
        const third = sorted[2]

        expect(first.amount).toBe(33.34)
        expect(second.amount).toBe(33.33)
        expect(third.amount).toBe(33.33)

        // Verify Total Sum
        const totalSum = first.amount + second.amount + third.amount
        expect(totalSum).toBe(100.00)

        // 4. Verify Descriptions
        expect(first.description).toContain('(1/3)')
        expect(second.description).toContain('(PR 2/3)')
        expect(third.description).toContain('(PR 3/3)')
    })

    it('should handle month-end dates correctly (Cenário B: Jan 31 -> Feb 28/29)', async () => {
        const account = await accountsRepository.create({ name: 'Conta Data', balance: 1000 })

        // Jan 31st 2024 (Leap Year? 2024 is leap year, so Feb 29)
        const startDate = new Date('2024-01-31T10:00:00')

        await transactionUseCase.execute({
            operation: 'expense',
            amount: 200,
            account_id: account.id,
            date: startDate,
            confirmed: true,
            installments_count: 2,
            interval_frequency: 'MONTHLY'
        })

        const allTransactions = transactionsRepository.items;
        expect(allTransactions).toHaveLength(2)

        const secondInstallment = allTransactions[1]

        // Expect Feb 29th 2024 (Last day of Feb)
        // JS Month is 0-indexed. Jan=0, Feb=1.
        expect(secondInstallment.date.getMonth()).toBe(1) // February
        expect(secondInstallment.date.getDate()).toBe(29) // Last day of leap feb
        // Ensure it didn't jump to March
    })

    it('should link installments via parent_transaction_id (Cenário C)', async () => {
        const account = await accountsRepository.create({ name: 'Conta Link', balance: 0 })

        const { transaction: first } = await transactionUseCase.execute({
            operation: 'expense',
            amount: 60,
            account_id: account.id,
            installments_count: 3,
            interval_frequency: 'WEEKLY',
            confirmed: true
        })

        const allTransactions = transactionsRepository.items;

        const second = allTransactions.find(t => t.description?.includes('(PR 2/3)'))
        const third = allTransactions.find(t => t.description?.includes('(PR 3/3)'))

        expect(second).toBeDefined()
        expect(third).toBeDefined()

        // Check Traceability
        expect(second?.parent_transaction_id).toBe(first.id)
        expect(third?.parent_transaction_id).toBe(first.id)
        expect(first.parent_transaction_id).toBeNull() // First one is the parent
    })
})
