
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface AdjustAccountBalanceUseCaseRequest {
    id: string
    newBalance: number
}

export class AdjustAccountBalanceUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({
        id,
        newBalance
    }: AdjustAccountBalanceUseCaseRequest) {
        // Usar transação do Transaction do Prisma para garantir atomicidade
        return await prisma.$transaction(async (tx) => {
            // Verificar se a conta existe
            const account = await tx.account.findUnique({
                where: { id }
            })

            if (!account) {
                throw new ResourceNotFoundError()
            }

            const currentBalance = account.balance
            const diff = newBalance - currentBalance

            // Se não houve mudança, não faz nada
            if (diff === 0) {
                return { account }
            }

            const amount = Math.abs(diff)
            const operation = diff > 0 ? 'IN' : 'OUT'

            // Criar a transação de ajuste
            await tx.transaction.create({
                data: {
                    account_id: id,
                    amount: amount,
                    operation: operation,
                    description: 'Ajuste de Saldo Manual',
                    confirmed: true,
                    date: new Date()
                }
            })

            // Atualizar o saldo da conta
            const updatedAccount = await tx.account.update({
                where: { id },
                data: {
                    balance: newBalance
                }
            })

            return { account: updatedAccount }
        })
    }
}
