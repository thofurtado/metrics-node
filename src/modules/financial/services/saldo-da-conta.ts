/**
 * Saldo de uma conta refeito pelos lançamentos pagos (o "Recalcular saldo"). Fase 4 do Mergulho (13:D1, resto):
 *
 * 1) Transferência: o lançamento de origem de uma transferência é gravado com operation 'transfer' e TIRA o valor da
 *    conta (a entrada na outra conta é uma receita). O recálculo só somava receitas e despesas: toda transferência que
 *    saiu da conta voltava para ela (Katatau: R$ 21.070,00 a mais numa conta). O "Destino de Caixa" da conferência
 *    também é 'transfer', mas PÕE o valor na conta (cashier_session_id preenchido).
 * 2) Ajuste manual / zeragem: o recálculo parte do zero e soma tudo desde o começo, então apaga qualquer "Ajustar saldo"
 *    feito pelo extrato e qualquer zeragem (Marujo, 08/10/2026: a Central iria de -R$ 5 mil para +R$ 988 mil). Enquanto
 *    o saldo de abertura da conta não for guardado (precisa de coluna nova; proposta no relatório da fase), a conta com
 *    ajuste manual não é recalculada: o caminho certo nela é "Ajustar saldo" pelo extrato.
 */

export interface LinhaDoSaldo {
    operation: string
    totalValue: number | null
    amount: number
    cashier_session_id?: string | null
}

const valorDaLinha = (t: LinhaDoSaldo) => Number(t.totalValue ?? t.amount ?? 0)

/** Soma dos lançamentos PAGOS da conta (receita entra, despesa sai, transferência de origem sai, destino de caixa entra). */
export function saldoPelosLancamentos(confirmadas: LinhaDoSaldo[]): number {
    let saldo = 0
    for (const t of confirmadas) {
        const v = valorDaLinha(t)
        if (t.operation === 'income') saldo += v
        else if (t.operation === 'expense') saldo -= v
        else if (t.operation === 'transfer') saldo += t.cashier_session_id ? v : -v
    }
    return Math.round(saldo * 100) / 100
}

/** Texto que o próprio recálculo grava no ajuste (não conta como acerto feito pelo dono). */
export const DESCRICAO_DO_RECALCULO = 'Recálculo Automático de Saldo (Soma de Transações Confirmadas)'

export interface AjusteDaConta {
    description: string | null
    new_balance: number
    created_at: Date
}

/** Último ajuste feito à mão (ou zeragem) na conta; null se só houve recálculos automáticos ou nada. */
export function ultimoAjusteManual(ajustes: AjusteDaConta[]): AjusteDaConta | null {
    const manuais = ajustes
        .filter(a => !(a.description || '').startsWith('Recálculo Automático'))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return manuais[0] || null
}

export function motivoParaNaoRecalcular(ajuste: AjusteDaConta | null): string | null {
    if (!ajuste) return null
    const quando = ajuste.created_at.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const para = ajuste.new_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return `Esta conta teve o saldo acertado à mão em ${quando} (para ${para}). O recálculo soma tudo desde o começo e apagaria esse acerto. Use "Ajustar saldo" com o saldo do extrato.`
}
