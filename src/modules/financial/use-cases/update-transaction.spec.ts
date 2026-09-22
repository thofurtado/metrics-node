import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryAccountsRepository } from '@/modules/financial/repositories/in-memory/in-memory-accounts-repository'
import { InMemoryTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transactions-repository'
import { UpdateTransactionUseCase } from './update-transaction'

// UpdateTransactionUseCase chama prisma.$transaction diretamente (não passa pelo branch "in-memory"
// como o TransactionUseCase faz), então simulamos o client aqui para poder testar sem banco real.
// O vi.mock é hoisted pelo Vitest para antes deste import, então o mock já vale para ele.
const fakeTxStore: { current: any } = { current: null }

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (cb: any) => cb({
            transaction: {
                update: async ({ data }: any) => {
                    Object.assign(fakeTxStore.current, data)
                    return fakeTxStore.current
                },
            },
        }),
    },
}))

let accountsRepository: InMemoryAccountsRepository
let transactionsRepository: InMemoryTransactionsRepository
let sut: UpdateTransactionUseCase

describe('Update Transaction Use Case', () => {
    beforeEach(async () => {
        accountsRepository = new InMemoryAccountsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()
        sut = new UpdateTransactionUseCase(transactionsRepository, accountsRepository)

        await accountsRepository.create({ name: 'Conta', balance: 0 } as any)
    })

    it('editar campo que não é valor/confirmação mantém o totalValue com juros no saldo (não reaplica só o principal)', async () => {
        const account = accountsRepository.items[0]
        account.balance = 500 // já refletindo a liquidação anterior de 110 (100 de principal + 10 de juros)

        const transaction = await transactionsRepository.create({
            operation: 'expense',
            amount: 100, // principal
            totalValue: 110, // valor realmente pago (com juros)
            interest: 10,
            confirmed: true,
            account_id: account.id,
            description: 'Conta de luz',
        } as any)
        fakeTxStore.current = { ...transaction }

        const { transaction: updated } = await sut.execute({
            id: transaction.id,
            description: 'Conta de luz (corrigido)',
        })

        expect(updated.totalValue).toBe(110)
        expect(account.balance).toBe(500) // reverteu -110 e reaplicou +110: não pode sobrar 490
    })

    it('mudar o valor de uma despesa confirmada usa o novo valor como totalValue e ajusta o saldo pela diferença', async () => {
        const account = accountsRepository.items[0]
        account.balance = 400 // já debitados os 100 originais

        const transaction = await transactionsRepository.create({
            operation: 'expense',
            amount: 100,
            totalValue: 100,
            confirmed: true,
            account_id: account.id,
        } as any)
        fakeTxStore.current = { ...transaction }

        await sut.execute({ id: transaction.id, amount: 130 })

        expect(account.balance).toBe(370) // devolve 100, debita 130
    })

    it('transação pendente que agora é confirmada usa o amount como totalValue', async () => {
        const account = accountsRepository.items[0]
        account.balance = 500

        const transaction = await transactionsRepository.create({
            operation: 'income',
            amount: 200,
            totalValue: null,
            confirmed: false,
            account_id: account.id,
        } as any)
        fakeTxStore.current = { ...transaction }

        const { transaction: updated } = await sut.execute({ id: transaction.id, confirmed: true })

        expect(updated.totalValue).toBe(200)
        expect(account.balance).toBe(700)
    })
})
