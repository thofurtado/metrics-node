
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

            // Criar o registro de ajuste na nova tabela
            await tx.accountAdjustment.create({
                data: {
                    account_id: id,
                    previous_balance: currentBalance,
                    new_balance: newBalance,
                    description: 'Ajuste de Saldo Manual'
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
