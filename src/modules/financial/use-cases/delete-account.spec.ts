import { InMemoryAccountsRepository } from '@/modules/financial/repositories/in-memory/in-memory-accounts-repository'
import { DeleteAccountUseCase, motivoParaNaoExcluirConta } from '@/modules/financial/use-cases/delete-account'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { describe, beforeEach, it, expect } from 'vitest'

let accountsRepository: InMemoryAccountsRepository
let sut: DeleteAccountUseCase

describe('Excluir conta (Mergulho 13:D2)', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        sut = new DeleteAccountUseCase(accountsRepository)
    })

    it('exclui conta sem nada ligado', async () => {
        const account = await accountsRepository.create({ name: 'Conta nova', balance: 0 })
        await sut.execute({ id: account.id })
        expect(await accountsRepository.findById(account.id)).toBeNull()
    })

    it('recusa conta com lançamentos e não apaga', async () => {
        const account = await accountsRepository.create({ name: 'Banco', balance: 10 })
        accountsRepository.links[account.id] = { transactions: 3 }
        await expect(sut.execute({ id: account.id })).rejects.toBeInstanceOf(ResourceDependencyError)
        expect(await accountsRepository.findById(account.id)).not.toBeNull()
    })

    it('conta que não existe dá não encontrada', async () => {
        await expect(sut.execute({ id: 'nao-existe' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

    it('a mensagem diz o que está ligado', () => {
        expect(motivoParaNaoExcluirConta({ transactions: 0, creditCards: 0, paymentMethods: 0, posMachines: 0 })).toBeNull()
        const msg = motivoParaNaoExcluirConta({ transactions: 2, creditCards: 1, paymentMethods: 0, posMachines: 1 })
        expect(msg).toContain('2 lançamento(s)')
        expect(msg).toContain('1 cartão(ões) de crédito')
        expect(msg).toContain('1 maquininha(s)')
        expect(msg).not.toContain('forma(s)')
    })
})
