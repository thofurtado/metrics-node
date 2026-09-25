/**
 * Regras da sincronia de caixa e venda PDV → nuvem (Fase 1 da "sincronia sem ponta solta", 25/09/2026).
 * Ver Metrics.PDV/docs/CAIXA-E-SINCRONIA-PDV-X-CONFERENCIA.md.
 *
 * Decisão do Thomás (24/09): com PDV, o caixa nasce no PDV e tem o MESMO código (UUID) na nuvem.
 * Por isso a nuvem nunca escolhe um caixa por conta própria:
 * 1) a venda fica no caixa informado pelo PDV; a venda que já existe nunca muda de caixa;
 * 2) caixa que ainda não existe na nuvem recusa a venda e o fechamento (o PDV manda a abertura antes);
 * 3) caixa já conferido na web (CHECKED) não recebe mudança nenhuma: venda nova, alteração, cancelamento ou movimento;
 * 4) reenviar abertura ou fechamento não reabre, não renumera e não rebaixa um caixa;
 * 5) reenviar a mesma venda não duplica os lançamentos; se os pagamentos mudaram, os lançamentos da venda são trocados.
 * Toda recusa volta com um código e uma mensagem em português: o PDV mostra o motivo na tela "Estado da sincronia".
 */

export const SESSION_OPEN = 'OPEN'
export const SESSION_PENDING = 'PENDING'
export const SESSION_CHECKED = 'CHECKED'

export type SyncRejectionCode =
    | 'VENDA_SEM_CAIXA'
    | 'CAIXA_NAO_ENVIADO'
    | 'CAIXA_JA_CONFERIDO'
    | 'CLIENTE_NAO_ENVIADO'
    | 'FUNCIONARIO_NAO_ENCONTRADO'

export const REJECTION_MESSAGES: Record<SyncRejectionCode, string> = {
    VENDA_SEM_CAIXA: 'Venda sem caixa: o PDV não informou o caixa desta venda, e a nuvem não escolhe um caixa por conta própria.',
    CAIXA_NAO_ENVIADO: 'O caixa ainda não existe na nuvem. Será aceito depois que a abertura do caixa subir.',
    CAIXA_JA_CONFERIDO: 'O caixa já foi conferido na nuvem e não recebe mudanças. Para receber, desfaça a conferência na web.',
    CLIENTE_NAO_ENVIADO: 'O cliente do fiado ainda não existe na nuvem. A venda será aceita depois que o cadastro do cliente subir.',
    FUNCIONARIO_NAO_ENCONTRADO: 'O colaborador desta venda não é um funcionário cadastrado no RH da nuvem; o vale não pode ser lançado.',
}

/** Recusa de um item da sincronia. O controller responde 409 (o PDV isola o item e mostra o motivo). */
export class SyncRejection extends Error {
    constructor(public readonly code: SyncRejectionCode, public readonly ref?: string) {
        super(REJECTION_MESSAGES[code])
        this.name = 'SyncRejection'
    }

    toResponse() {
        const ref = this.ref ? ` (${this.ref.slice(0, 8)})` : ''
        return { message: `${this.message}${ref}`, code: this.code, ref: this.ref ?? null }
    }
}

export interface SessionState {
    status: string
}

/** A venda que já existe na nuvem nunca muda de caixa; a nova fica no caixa que o PDV informou. */
export function chooseSaleSessionId(requested?: string | null, existingSaleSessionId?: string | null): string | null {
    return existingSaleSessionId || requested || null
}

/**
 * Confere se a venda pode ser gravada no caixa escolhido. `changesSession` = a venda é nova ou muda algo
 * (valores, status, pagamentos, itens); reenvio idêntico para caixa conferido é aceito sem mexer em nada.
 */
export function checkSaleSession(
    sessionId: string | null,
    session: SessionState | null,
    changesSession: boolean,
): SyncRejectionCode | null {
    if (!sessionId) return 'VENDA_SEM_CAIXA'
    if (!session) return 'CAIXA_NAO_ENVIADO'
    if (session.status === SESSION_CHECKED && changesSession) return 'CAIXA_JA_CONFERIDO'
    return null
}

/** Caixa conferido não recebe movimento, cancelamento nem mudança de venda. */
export function acceptsChanges(session: SessionState | null): boolean {
    return !!session && session.status !== SESSION_CHECKED
}

// ---------------------------------------------------------------------------------------------------------------
// Lançamentos de caixa da venda (um por pagamento)
// ---------------------------------------------------------------------------------------------------------------

export interface SalePaymentInput {
    Method: string
    Amount: number
}

export interface SaleEntry {
    identification: string
    payment_method: string
    amount: number
}

/** Trecho que identifica os lançamentos de uma venda no texto do lançamento ("Balcao - Pedido #1f9408ee ..."). */
export function saleEntryTag(saleUuid: string): string {
    return `Pedido #${saleUuid.slice(0, 8)}`
}

/**
 * Lançamentos que a venda deve ter no caixa, no MESMO formato de texto usado desde sempre
 * (assim os lançamentos já gravados são reconhecidos e não duplicam). Venda cancelada não tem lançamento.
 */
export function buildSaleEntries(saleUuid: string, origin: string | null | undefined, status: string, payments: SalePaymentInput[]): SaleEntry[] {
    if (status === 'CANCELLED') return []
    const prefix = `${origin || 'PDV'} - ${saleEntryTag(saleUuid)}`
    const entries: SaleEntry[] = []
    let payIndex = 0
    for (const pay of payments) {
        if (pay.Amount <= 0) continue
        payIndex++
        const identification = payments.length === 1
            ? prefix
            : `${prefix} [${payIndex}/${payments.length}] (${pay.Method})`
        entries.push({ identification, payment_method: pay.Method, amount: pay.Amount })
    }
    return entries
}

const cents = (value: number) => Math.round(value * 100)

function entryKey(e: SaleEntry): string {
    return `${e.identification}|${e.payment_method}|${cents(e.amount)}`
}

/** Os lançamentos gravados são exatamente os que a venda deve ter (mesmo texto, forma e valor, na mesma quantidade)? */
export function sameEntries(existing: SaleEntry[], desired: SaleEntry[]): boolean {
    if (existing.length !== desired.length) return false
    const count = new Map<string, number>()
    for (const e of existing) count.set(entryKey(e), (count.get(entryKey(e)) ?? 0) + 1)
    for (const d of desired) {
        const k = entryKey(d)
        const n = count.get(k) ?? 0
        if (n === 0) return false
        count.set(k, n - 1)
    }
    return true
}

export interface StoredSale {
    total_amount: number
    discount: number | null
    status: string
}

/** A venda recebida muda os valores ou o status da venda já gravada? */
export function saleFieldsChanged(stored: StoredSale, incoming: { TotalAmount: number; Discount: number; Status: string }): boolean {
    return cents(stored.total_amount) !== cents(incoming.TotalAmount)
        || cents(stored.discount ?? 0) !== cents(incoming.Discount ?? 0)
        || stored.status !== incoming.Status
}

/** Forma de pagamento a prazo (fiado): gera conta do cliente e exige o cliente na nuvem. */
export function isTermPayment(method: string | null | undefined): boolean {
    const m = (method || '').toLowerCase()
    return m.includes('prazo') || m.includes('correntista') || m.includes('fiado')
}

// ---------------------------------------------------------------------------------------------------------------
// Abertura e fechamento
// ---------------------------------------------------------------------------------------------------------------

export interface StoredSession {
    status: string
    period: string
    initial_balance: number
    opened_at: Date
    closed_at: Date | null
}

/**
 * Caixa criado pela regra antiga do fechamento (abertura perdida): fundo 0, abertura = fechamento e período "Caixa PDV".
 * Quando a abertura verdadeira chega, esses dados são corrigidos (menos em caixa já conferido).
 */
export function isPlaceholderFromClose(s: StoredSession): boolean {
    return s.status !== SESSION_CHECKED
        && s.period === 'Caixa PDV'
        && s.initial_balance === 0
        && !!s.closed_at
        && s.opened_at.getTime() === s.closed_at.getTime()
}

/** O fechamento só muda caixa ABERTO (vai para conferência); reenvio para caixa em conferência ou conferido não mexe. */
export function shouldApplyClose(status: string): boolean {
    return status === SESSION_OPEN
}
