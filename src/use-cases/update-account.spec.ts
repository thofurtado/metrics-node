import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { UpdateAccountUseCase } from './update-account'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

let accountsRepository: InMemoryAccountsRepository
let sut: UpdateAccountUseCase

describe('Update Account Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        sut = new UpdateAccountUseCase(accountsRepository)
    })

    it('should be able to update an account', async () => {
        const account = await accountsRepository.create({
            name: 'Original Name',
            balance: 100,
            description: 'Desc'
        })

        const { account: updatedAccount } = await sut.execute({
            id: account.id,
            name: 'New Name',
        })

        expect(updatedAccount.name).toEqual('New Name')
        expect(updatedAccount.balance).toEqual(100)
    })

    it('should not be able to update a non-existing account', async () => {
        await expect(() =>
            sut.execute({
                id: 'non-existing-id',
                name: 'New Name',
            })
        ).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
