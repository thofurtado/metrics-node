import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'
import {
    DESCRICAO_DO_RECALCULO, motivoParaNaoRecalcular, saldoPelosLancamentos, ultimoAjusteManual,
} from '@/modules/financial/services/saldo-da-conta'

/** Recálculo recusado porque a conta tem acerto manual (Mergulho 13:D1). */
export class RecalculoBloqueadoError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'RecalculoBloqueadoError'
    }
}

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
            // Pendente (precisa de migração; proposta no relatório da Fase 4): o saldo com que a conta começou não fica
            // guardado em lugar nenhum, então o recálculo ainda parte do zero.
            // Fase 4 do Mergulho (13:D1, resto): entram também as transferências (a de origem tira o valor; o "Destino
            // de Caixa" põe). Ver services/saldo-da-conta.ts.
            const confirmadas = await tx.transaction.findMany({
                where: {
                    account_id: id,
                    operation: { in: ['income', 'expense', 'transfer'] },
                    confirmed: true
                },
                select: { operation: true, totalValue: true, amount: true, cashier_session_id: true }
            })

            const newBalance = saldoPelosLancamentos(confirmadas)

            // Conta com acerto manual (ou zeragem): o recálculo apagaria o acerto. Só a prévia é mostrada, com o motivo.
            const ajustes = await tx.accountAdjustment.findMany({
                where: { account_id: id },
                select: { description: true, new_balance: true, created_at: true }
            })
            const motivoBloqueio = motivoParaNaoRecalcular(ultimoAjusteManual(ajustes))

            if (simular) {
                return { account, saldoAtual: account.balance, saldoNovo: newBalance, motivoBloqueio }
            }

            if (motivoBloqueio) {
                throw new RecalculoBloqueadoError(motivoBloqueio)
            }

            // Registrar o ajuste de saldo no banco de dados para rastreabilidade
            await tx.accountAdjustment.create({
                data: {
                    account_id: id,
                    previous_balance: account.balance,
                    new_balance: newBalance,
                    description: DESCRICAO_DO_RECALCULO
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
