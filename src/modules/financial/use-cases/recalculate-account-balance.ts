import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

interface RecalculateAccountBalanceUseCaseRequest {
    id: string
    /** Só calcula e devolve o antes e o depois, sem gravar (a tela mostra antes de o dono confirmar). */
    simular?: boolean
}

export class RecalculateAccountBalanceUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({ id, simular = false }: RecalculateAccountBalanceUseCaseRequest) {
        return await prisma.$transaction(async (tx) => {
            const account = await tx.account.findUnique({
                where: { id }
            })

            if (!account) {
                throw new ResourceNotFoundError()
            }

            // Fase 1 do Mergulho (13:D1, parte da soma): antes somava o "valor total" de todas as linhas e só usava o
            // "valor" quando NENHUMA linha tinha total; se algumas tinham e outras não, as sem total ficavam fora da
            // conta. Agora cada linha entra com o seu valor total ou, se não tiver, com o valor (a mesma regra do
            // apagar, que devolve totalValue ?? amount ao saldo).
            // Pendente (decisão do Thomás): o saldo com que a conta começou não fica guardado em lugar nenhum, então
            // o recálculo ainda parte do zero.
            const confirmadas = await tx.transaction.findMany({
                where: {
                    account_id: id,
                    operation: { in: ['income', 'expense'] },
                    confirmed: true
                },
                select: { operation: true, totalValue: true, amount: true }
            })

            const valorDaLinha = (t: { totalValue: number | null, amount: number }) => Number(t.totalValue ?? t.amount ?? 0)
            const incomeSum = confirmadas.filter(t => t.operation === 'income').reduce((s, t) => s + valorDaLinha(t), 0)
            const expenseSum = confirmadas.filter(t => t.operation === 'expense').reduce((s, t) => s + valorDaLinha(t), 0)

            const newBalance = Math.round((incomeSum - expenseSum) * 100) / 100

            if (simular) {
                return { account, saldoAtual: account.balance, saldoNovo: newBalance }
            }

            // Registrar o ajuste de saldo no banco de dados para rastreabilidade
            await tx.accountAdjustment.create({
                data: {
                    account_id: id,
                    previous_balance: account.balance,
                    new_balance: newBalance,
                    description: 'Recálculo Automático de Saldo (Soma de Transações Confirmadas)'
                }
            })

            // Atualizar o saldo da conta
            const updatedAccount = await tx.account.update({
                where: { id },
                data: {
                    balance: newBalance
                }
            })

            return { account: updatedAccount, saldoAtual: account.balance, saldoNovo: newBalance }
        })
    }
}
