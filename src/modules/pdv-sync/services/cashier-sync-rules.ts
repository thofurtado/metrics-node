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

/**
 * Forma de pagamento a prazo (fiado) pelo NOME, para o PDV antigo que não manda o tipo: gera conta do cliente e exige o
 * cliente na nuvem. Os mesmos nomes do PDV (`FormaPagamentoTipo.EhPrazo`): desde 10/10/2026 "permuta" também (o PDV já
 * exigia o cliente nela, mas a nuvem não abria a conta).
 */
export function isTermPayment(method: string | null | undefined): boolean {
    const m = (method || '').toLowerCase()
    return m.includes('prazo') || m.includes('correntista') || m.includes('fiado') || m.includes('permuta')
}

/** Consumo de funcionário pelo NOME da forma (PDV antigo): os mesmos nomes do PDV (`FormaPagamentoTipo.EhFuncionario`). */
export function isEmployeePayment(method: string | null | undefined): boolean {
    const m = (method || '').toLowerCase()
    return m.includes('funcionário') || m.includes('funcionario') || m.includes('colaborador')
}

export type PaymentKind = 'PRAZO' | 'FUNCIONARIO' | null

/**
 * Tipo do pagamento: o que o PDV diz (desde a 2.5.23, `Tipo`, calculado pela mesma regra que exige o cliente ou o
 * funcionário na tela) ou, no PDV antigo, pelo nome da forma.
 */
export function paymentKind(pay: { Method?: string | null; Tipo?: string | null }): PaymentKind {
    const tipo = (pay.Tipo || '').trim().toUpperCase()
    if (tipo === 'PRAZO' || tipo === 'FUNCIONARIO') return tipo
    if (tipo) return null // o PDV disse que não é nenhum dos dois
    if (isTermPayment(pay.Method)) return 'PRAZO'
    if (isEmployeePayment(pay.Method)) return 'FUNCIONARIO'
    return null
}

// ---------------------------------------------------------------------------------------------------------------
// Conta do cliente (fiado) da venda do PDV — decisão do Thomás de 25/09/2026: "o registro oficial do fiado é a conta do
// cliente (client_tabs); a conferência não cria outra receita a prazo para o mesmo fiado". Desde 10/10/2026 a conta
// acompanha a venda: troca de pagamento e cancelamento mudam ou tiram a parte ainda não paga.
// ---------------------------------------------------------------------------------------------------------------

export interface TabPayment {
    amount: number
    clientId: string | null
    kind: PaymentKind
    holderName?: string | null
}

export interface DesiredTab {
    clientId: string
    amount: number
    holderName: string | null
}

/** Quanto a venda deixa na conta de cada cliente (fiado somado por cliente). Venda cancelada não deixa nada. */
export function desiredClientTabs(status: string, payments: TabPayment[]): DesiredTab[] {
    if (status === 'CANCELLED') return []
    const porCliente = new Map<string, DesiredTab>()
    for (const p of payments) {
        if (p.kind !== 'PRAZO' || !p.clientId || !(p.amount > 0)) continue
        const atual = porCliente.get(p.clientId)
        if (atual) {
            atual.amount = cents(atual.amount + p.amount) / 100
            if (!atual.holderName && p.holderName) atual.holderName = p.holderName
        } else {
            porCliente.set(p.clientId, { clientId: p.clientId, amount: cents(p.amount) / 100, holderName: p.holderName || null })
        }
    }
    return [...porCliente.values()]
}

export interface StoredTab {
    id: string
    client_id: string
    amount: number
    is_paid: boolean
}

export interface TabPlan {
    create: DesiredTab[]
    update: { id: string; amount: number }[]
    remove: string[]
}

/**
 * O que mudar nas contas de uma venda para ficarem como a venda está agora. Parte já paga nunca é mexida: o que fica em
 * aberto para cada cliente é o fiado da venda menos o que ele já pagou dela (baixa parcial na web divide a conta em
 * paga + saldo). Conta aberta de cliente que saiu da venda (pagamento trocado, venda cancelada) é tirada.
 */
export function planClientTabs(stored: StoredTab[], desired: DesiredTab[]): TabPlan {
    const plan: TabPlan = { create: [], update: [], remove: [] }
    const clientes = new Set<string>([...stored.map(t => t.client_id), ...desired.map(d => d.clientId)])
    for (const clientId of clientes) {
        const queria = desired.find(d => d.clientId === clientId)
        const pago = stored.filter(t => t.client_id === clientId && t.is_paid).reduce((s, t) => s + cents(t.amount), 0)
        const abertas = stored.filter(t => t.client_id === clientId && !t.is_paid)
        const alvo = Math.max(0, cents(queria?.amount ?? 0) - pago)

        if (alvo === 0) {
            plan.remove.push(...abertas.map(t => t.id))
            continue
        }
        if (abertas.length === 0) {
            plan.create.push({ clientId, amount: alvo / 100, holderName: queria?.holderName ?? null })
            continue
        }
        const [primeira, ...sobra] = abertas
        if (cents(primeira.amount) !== alvo) plan.update.push({ id: primeira.id, amount: alvo / 100 })
        plan.remove.push(...sobra.map(t => t.id))
    }
    return plan
}

/** Texto da conta do cliente: o mesmo formato de sempre (a marca "Pedido #xxxxxxxx" liga a conta à venda). */
export function clientTabDescription(saleUuid: string, holderName: string | null | undefined): string {
    return `Venda a Prazo - ${saleEntryTag(saleUuid)} (${holderName || 'Cliente'})`
}

// ---------------------------------------------------------------------------------------------------------------
// Movimentos de caixa do PDV (10/10/2026): os mesmos tipos da conferência da web, para ela não adivinhar pelo texto
// (decisões do Thomás de 25/09/2026: sangria do PDV = sempre recolhimento; vale com o funcionário do RH).
// ---------------------------------------------------------------------------------------------------------------

export interface MovementEntryType {
    type: string
    is_withdrawal: boolean
    is_addition: boolean
}

export function movementEntryType(tipo: string | null | undefined): MovementEntryType {
    const t = (tipo || '').toLowerCase()
    if (t.includes('suprimento') || t.includes('sobracaixa')) return { type: 'ADDITION', is_withdrawal: false, is_addition: true }
    if (t.includes('vale')) return { type: 'WITHDRAWAL_EMPLOYEE', is_withdrawal: true, is_addition: false }
    if (t.includes('saidaoperacional') || t.includes('despesa')) return { type: 'EXPENSE', is_withdrawal: true, is_addition: false }
    if (t.includes('sangria')) return { type: 'WITHDRAWAL_OWNER', is_withdrawal: true, is_addition: false }
    return { type: 'WITHDRAWAL', is_withdrawal: true, is_addition: false }
}

/** Texto do movimento: o tipo e a observação, sem repetir o tipo quando a observação já começa com ele ("Vale: Ana"). */
export function movementIdentification(tipo: string, observacao: string | null | undefined): string {
    const obs = (observacao || '').trim()
    if (!obs) return tipo
    return obs.toLowerCase().startsWith(tipo.toLowerCase()) ? obs : `${tipo}: ${obs}`
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

// ---------------------------------------------------------------------------------------------------------------
// Fase 2 (25/09/2026): terminal do caixa, contado no fechamento e estoque do cancelamento
// ---------------------------------------------------------------------------------------------------------------

/**
 * Terminal do caixa: o caixa aberto na web não tem terminal. Quando o PDV "vincula" esse caixa (decisão do Thomás),
 * o caixa passa a ter o terminal do PDV. Um terminal já gravado nunca é trocado.
 */
export function terminalToStore(current: string | null | undefined, incoming: string | null | undefined): string | null {
    if (current) return current
    const t = (incoming || '').trim()
    return t ? t : null
}

/** Contado por forma de pagamento no fechamento: só números finitos, arredondados em centavos. */
export function normalizeCounted(counted: Record<string, unknown> | null | undefined): Record<string, number> | null {
    if (!counted || typeof counted !== 'object') return null
    const result: Record<string, number> = {}
    for (const [method, value] of Object.entries(counted)) {
        const n = typeof value === 'number' ? value : Number(value)
        if (method.trim() && Number.isFinite(n)) result[method.trim()] = Math.round(n * 100) / 100
    }
    return Object.keys(result).length > 0 ? result : null
}

/**
 * Cancelamento de venda que já subiu (decisão do Thomás, 25/09): o estoque segue a escolha do operador no PDV.
 * "ESTORNO" (Devolver ao Estoque) devolve; "DESPERDICIO" (Registrar como Desperdício) mantém a saída.
 * Sem a escolha (PDV antigo) nada é devolvido, como antes. Devolve uma vez só.
 */
export function shouldReverseStock(destino: string | null | undefined, alreadyRestored: boolean): boolean {
    return !alreadyRestored && (destino || '').trim().toUpperCase() === 'ESTORNO'
}
