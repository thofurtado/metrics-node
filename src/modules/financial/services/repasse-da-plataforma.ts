/**
 * Liquidação do repasse das plataformas (iFood/99Food), 15/10/2026 (plano 2.3, decisão D2 do Thomás): baixar o repasse de
 * uma plataforma numa data baixa junto as comissões pendentes da mesma plataforma e da mesma data; a conta recebe o líquido
 * (repasse − comissões). A tela mostra o previsto e deixa digitar o que caiu; a diferença vira um ajuste com motivo
 * (promoção, estorno). O caminho da conta segue a maquininha: o repasse e a comissão esperam na Conta de Transação com a
 * marca [DEST: conta] e, na baixa, vão para a conta de verdade.
 *
 * Funções puras: o controlador (platform-settlements.ts) e os testes usam as mesmas regras.
 */

import { diaDeBrasilia } from '@/modules/cashier/services/plataformas'

export interface TransacaoDoRepasse {
    id: string
    operation: string
    amount: number
    totalValue: number | null
    confirmed: boolean
    account_id: string | null
    description: string | null
    data_vencimento: Date
    platform_id: string | null
    platform_settlement_id: string | null
    cashier_session_id: string | null
}

export interface PlataformaDoRepasse {
    id: string
    code: string
    name: string
    account_id: string | null
}

const centavos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

export type SentidoDoSaldo = 'A_RECEBER' | 'A_PAGAR' | 'ZERADO'

/**
 * Para que lado vai o saldo da plataforma numa data (15/10/2026, "conta corrente da plataforma", aprovada pelo Thomás): com
 * pedidos pagos na entrega a plataforma não tem o que repassar e só cobra a comissão, então o saldo pode ficar negativo. Aí a
 * Liquidação é "a pagar à plataforma": a loja paga a diferença e a conta escolhida perde esse valor.
 */
export function sentidoDoSaldo(saldo: number): SentidoDoSaldo {
    const v = centavos(saldo)
    if (Math.abs(v) < 0.01) return 'ZERADO'
    return v > 0 ? 'A_RECEBER' : 'A_PAGAR'
}
const valor = (t: { totalValue: number | null; amount: number }) => Number(t.totalValue ?? t.amount ?? 0)

/** O ajuste da diferença é o único lançamento da baixa que não veio de um caixa. */
export const ehAjusteDoRepasse = (t: { cashier_session_id: string | null }) => !t.cashier_session_id

export interface GrupoDoRepasse {
    /** Pendente: "plataforma|dia"; liquidado: o código da liquidação */
    chave: string
    situacao: 'PENDENTE' | 'LIQUIDADO'
    settlement_id: string | null
    plataforma: PlataformaDoRepasse | null
    payout_date: string
    receitas: TransacaoDoRepasse[]
    comissoes: TransacaoDoRepasse[]
    ajustes: TransacaoDoRepasse[]
    total_receitas: number
    total_comissoes: number
    /** Repasse − comissões: o que a plataforma deve depositar. Negativo = a loja deve à plataforma (ver sentido) */
    previsto: number
    /** O mesmo previsto, com o nome que a tela usa para o saldo da "conta corrente da plataforma" (15/10/2026) */
    saldo_previsto: number
    /** A_RECEBER: a plataforma deposita; A_PAGAR: as comissões e taxas passaram as receitas e a loja paga a diferença (boleto,
     *  débito); ZERADO: nada a mexer. Pendente: pelo previsto; liquidado: pelo que de fato caiu/saiu */
    sentido: SentidoDoSaldo
    /** Liquidado: previsto + ajustes (o que caiu na conta). Pendente: null */
    recebido: number | null
    /** Caixas de onde vieram o repasse e as comissões */
    caixas: string[]
}

/** Agrupa por plataforma × data do repasse (pendentes) ou pela liquidação (liquidados). */
export function agruparRepasses(transacoes: TransacaoDoRepasse[], plataformas: PlataformaDoRepasse[]): GrupoDoRepasse[] {
    const porId = new Map(plataformas.map(p => [p.id, p]))
    const grupos = new Map<string, GrupoDoRepasse>()
    for (const t of transacoes) {
        if (!t.platform_id) continue
        const liquidado = Boolean(t.platform_settlement_id)
        const dia = diaDeBrasilia(new Date(t.data_vencimento))
        const chave = liquidado ? (t.platform_settlement_id as string) : `${t.platform_id}|${dia}`
        let g = grupos.get(chave)
        if (!g) {
            g = {
                chave, situacao: liquidado ? 'LIQUIDADO' : 'PENDENTE', settlement_id: t.platform_settlement_id,
                plataforma: porId.get(t.platform_id) ?? null, payout_date: dia,
                receitas: [], comissoes: [], ajustes: [], total_receitas: 0, total_comissoes: 0, previsto: 0, saldo_previsto: 0,
                sentido: 'ZERADO', recebido: null, caixas: [],
            }
            grupos.set(chave, g)
        }
        if (liquidado && ehAjusteDoRepasse(t)) g.ajustes.push(t)
        else {
            if (t.operation === 'income') g.receitas.push(t)
            else if (t.operation === 'expense') g.comissoes.push(t)
            else continue
            // a data do repasse é a do repasse/comissão (o ajuste pode ter outra)
            g.payout_date = dia
            if (t.cashier_session_id && !g.caixas.includes(t.cashier_session_id)) g.caixas.push(t.cashier_session_id)
        }
    }
    for (const g of grupos.values()) {
        g.total_receitas = centavos(g.receitas.reduce((s, t) => s + valor(t), 0))
        g.total_comissoes = centavos(g.comissoes.reduce((s, t) => s + valor(t), 0))
        g.previsto = centavos(g.total_receitas - g.total_comissoes)
        g.saldo_previsto = g.previsto
        if (g.situacao === 'LIQUIDADO') {
            const ajustes = g.ajustes.reduce((s, t) => s + (t.operation === 'income' ? valor(t) : -valor(t)), 0)
            g.recebido = centavos(g.previsto + ajustes)
        }
        g.sentido = sentidoDoSaldo(g.recebido ?? g.previsto)
    }
    return [...grupos.values()].sort((a, b) => a.payout_date.localeCompare(b.payout_date) || (a.plataforma?.name ?? '').localeCompare(b.plataforma?.name ?? ''))
}

/** A conta marcada na transação pela conferência ("... [DEST: conta]"), como na maquininha. */
export function contaDaMarca(descricao: string | null | undefined): string | null {
    const m = (descricao ?? '').match(/\[DEST:\s*([^\]]+)\]/)
    return m ? m[1].trim() : null
}

/** Descrição depois da baixa: sem a marca [DEST] e com "(Liquidado)", como a maquininha. */
export function descricaoLiquidada(descricao: string | null | undefined): string {
    const limpa = (descricao ?? '').replace(/\[DEST:\s*[^\]]+\]/, '').trim() || 'Repasse da plataforma'
    return limpa.endsWith('(Liquidado)') ? limpa : `${limpa} (Liquidado)`
}

/** Descrição ao desfazer a baixa: tira o "(Liquidado)". */
export function descricaoDesfeita(descricao: string | null | undefined): string {
    return (descricao ?? '').replace(/\s*\(Liquidado\)\s*$/, '').trim()
}

/**
 * A conta onde o repasse caiu: a escolhida na tela; senão a da plataforma (a de hoje, que o Ronaldo pode ter ligado depois
 * da conferência); senão a marcada na conferência ([DEST]); senão a conta das transações, se não for a de transação.
 * null = ninguém sabe (plataforma sem conta e sem escolha): a tela tem de perguntar.
 */
export function contaDoRepasse(
    escolhida: string | null | undefined,
    daPlataforma: string | null | undefined,
    transacoes: { description: string | null; account_id: string | null }[],
    contasDeTransacao: Set<string>,
): string | null {
    if (escolhida) return escolhida
    if (daPlataforma) return daPlataforma
    for (const t of transacoes) {
        const marca = contaDaMarca(t.description)
        if (marca) return marca
    }
    for (const t of transacoes) {
        if (t.account_id && !contasDeTransacao.has(t.account_id)) return t.account_id
    }
    return null
}

/**
 * O ajuste da diferença entre o que caiu e o previsto: caiu menos = despesa (promoção, estorno, taxa a mais); caiu mais =
 * receita. Menos de 1 centavo = nada.
 */
export function ajusteDoRepasse(previsto: number, recebido: number): { operation: 'income' | 'expense'; amount: number } | null {
    const diferenca = centavos(recebido - previsto)
    if (Math.abs(diferenca) < 0.01) return null
    return { operation: diferenca > 0 ? 'income' : 'expense', amount: Math.abs(diferenca) }
}

/** Quanto a baixa (ou a volta dela) mexe no saldo de cada conta: receita entra, despesa sai. */
export function efeitoNoSaldo(transacoes: { operation: string; amount: number; totalValue: number | null; account_id: string | null }[]): Map<string, number> {
    const porConta = new Map<string, number>()
    for (const t of transacoes) {
        if (!t.account_id) continue
        const sinal = t.operation === 'income' ? 1 : t.operation === 'expense' ? -1 : 0
        porConta.set(t.account_id, centavos((porConta.get(t.account_id) ?? 0) + sinal * valor(t)))
    }
    return porConta
}
