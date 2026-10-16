import { Prisma } from '@prisma/client'
import { diaOperacional, inicioDoDiaOperacional, intervaloDoDiaOperacional } from '@/lib/dia-operacional'

/**
 * Histórico do estoque (decisão D6 do Thomás, 16/10/2026; ESPEC-VENDAS-E-ESTOQUE.md): uma consulta na tabela de movimentos
 * (`stocks`, uma linha por movimento), sem tabela nova. Aparece em dois lugares com a MESMA regra: na ficha do produto
 * (Mercadorias › Histórico) e no Controle de Estoque › Histórico, com filtro por produto.
 * Cada linha diz: data e hora, tipo (venda, compra/NF-e, perda, ajuste, estorno), quantidade, saldo antes e depois, quem fez e
 * de onde veio (a venda ou a nota de compra). Funções puras aqui; a consulta fica no controlador do estoque.
 */

const DIA_MS = 24 * 60 * 60 * 1000

// ─── Período ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Periodo = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all' | 'custom'

const diaValido = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)

/**
 * Intervalo [início, fim) do período, em dias operacionais (viram às 05:00 de Brasília, como o caixa). "Últimos 7 dias" = hoje
 * e os 6 dias antes; "últimos 30 dias" = hoje e os 29 antes (antes a tela dizia 30 dias e a nuvem contava desde o dia 1º).
 */
export function intervaloDoPeriodo(periodo: string | undefined, de?: string | null, ate?: string | null, agora: Date = new Date()): { inicio?: Date; fim?: Date } {
    const hoje = intervaloDoDiaOperacional(agora)
    const voltar = (dias: number) => new Date(hoje.inicio.getTime() - dias * DIA_MS)
    switch (periodo) {
        case 'today': return { inicio: hoje.inicio, fim: hoje.fim }
        case 'yesterday': return { inicio: voltar(1), fim: hoje.inicio }
        case '7days': return { inicio: voltar(6) }
        case '30days': return { inicio: voltar(29) }
        case 'month': return { inicio: inicioDoDiaOperacional(`${diaOperacional(agora).slice(0, 7)}-01`) }
        case 'custom': {
            const d1 = diaValido(de)
            const d2 = diaValido(ate)
            return {
                ...(d1 ? { inicio: inicioDoDiaOperacional(d1) } : {}),
                ...(d2 ? { fim: new Date(inicioDoDiaOperacional(d2).getTime() + DIA_MS) } : {}),
            }
        }
        default: return {}
    }
}

// ─── Tipos de movimento ────────────────────────────────────────────────────────────────────────────────────────────────

export type TipoDoHistorico = 'VENDA' | 'COMPRA' | 'PERDA' | 'AJUSTE' | 'ESTORNO' | 'OUTRO'

const MOTIVOS_DE_PERDA = ['QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO'] as const

/** Nomes antigos do filtro (a tela mandava SALE_PDV e a nuvem esperava VENDA: o extrato mostrava "0 registros"). */
const APELIDOS: Record<string, TipoDoHistorico> = {
    VENDA: 'VENDA', VENDAS: 'VENDA', SALE_PDV: 'VENDA',
    COMPRA: 'COMPRA', COMPRAS: 'COMPRA', ENTRADA: 'COMPRA', PURCHASE_NFE: 'COMPRA',
    PERDA: 'PERDA', PERDAS: 'PERDA', QUEBRA: 'PERDA', LOSS_WASTE: 'PERDA',
    AJUSTE: 'AJUSTE', AJUSTES: 'AJUSTE', BALANCO: 'AJUSTE', BALANCE_AUDIT: 'AJUSTE',
    ESTORNO: 'ESTORNO', ESTORNOS: 'ESTORNO', DEVOLUCAO: 'ESTORNO', RETURN_CANCEL: 'ESTORNO',
}

export function tipoDoFiltro(tipo: string | null | undefined): TipoDoHistorico | null {
    const t = (tipo ?? '').trim().toUpperCase()
    return APELIDOS[t] ?? null
}

/**
 * Filtro do tipo na tabela de movimentos. A baixa de uma venda cancelada que NÃO voltou ao estoque é perda (D12: "desperdício
 * mantém a baixa e aparece como perda"), então sai de Vendas e entra em Perdas.
 */
export function filtroDoTipo(tipo: TipoDoHistorico | null): Prisma.StockWhereInput | null {
    const cancelada: Prisma.SaleItemWhereInput = { sale: { status: 'CANCELLED' }, stocks: { none: { operation: 'IN' } } }
    switch (tipo) {
        case 'VENDA':
            return {
                description: 'VENDA',
                OR: [
                    { sale_item_id: null },
                    { saleItem: { sale: { status: { not: 'CANCELLED' } } } },
                    { saleItem: { stocks: { some: { operation: 'IN' } } } },
                ],
            }
        case 'PERDA':
            return { OR: [{ description: { in: [...MOTIVOS_DE_PERDA] } }, { description: 'VENDA', saleItem: cancelada }] }
        case 'COMPRA': return { description: 'COMPRA' }
        case 'AJUSTE': return { description: { in: ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] } }
        case 'ESTORNO': return { description: 'DEVOLUCAO' }
        default: return null
    }
}

export interface VendaDaLinha {
    id: string
    status: string
    origin: string | null
    origin_identifier: string | null
    /** Quem operava o caixa da venda (o PDV ainda não manda o operador de cada venda). */
    operador: string | null
    vendedor: string | null
    /** O item voltou ao estoque (tem estorno). */
    estornado: boolean
}

export interface CancelamentoDaLinha {
    reason: string | null
    user_name: string | null
    stock_destination: string | null
    cancelled_at: Date | null
    origin_identifier: string | null
}

export interface LinhaDoEstoque {
    id: string
    created_at: Date
    operation: 'IN' | 'OUT'
    description: string | null
    quantity: number
    unit_cost: number | null
    product_id: string | null
    supply_id: string | null
    sale_item_id: string | null
    user_name: string | null
    balance_after: number | null
    note: string | null
    document_key: string | null
    document_number: string | null
    batch_number?: string | null
    supplier_cnpj?: string | null
}

const ROTULOS_DE_PERDA: Record<string, string> = {
    QUEBRA: 'Perda · quebra',
    PERDA: 'Perda',
    CORTESIA: 'Perda · cortesia',
    CONSUMO_INTERNO: 'Perda · consumo interno',
}

export function tipoDoMovimento(linha: Pick<LinhaDoEstoque, 'operation' | 'description' | 'sale_item_id' | 'document_key' | 'document_number'>, venda?: VendaDaLinha | null): { tipo: TipoDoHistorico; rotulo: string } {
    const d = linha.description ?? ''
    if (d === 'VENDA' && linha.operation === 'OUT') {
        if (venda && venda.status === 'CANCELLED' && !venda.estornado) return { tipo: 'PERDA', rotulo: 'Perda · venda cancelada' }
        return { tipo: 'VENDA', rotulo: 'Venda' }
    }
    if (d === 'DEVOLUCAO') return linha.sale_item_id ? { tipo: 'ESTORNO', rotulo: 'Estorno da venda' } : { tipo: 'ESTORNO', rotulo: 'Devolução' }
    if (d === 'COMPRA') return { tipo: 'COMPRA', rotulo: linha.document_key || linha.document_number ? 'Compra · NF-e' : 'Compra' }
    if (ROTULOS_DE_PERDA[d]) return { tipo: 'PERDA', rotulo: ROTULOS_DE_PERDA[d] }
    if (d === 'AJUSTE_POSITIVO' || d === 'AJUSTE_NEGATIVO') return { tipo: 'AJUSTE', rotulo: 'Ajuste' }
    return { tipo: 'OUTRO', rotulo: 'Movimento' }
}

// ─── Venda e cancelamento ──────────────────────────────────────────────────────────────────────────────────────────────

const NOMES_DA_ORIGEM: Record<string, string> = {
    BALCAO: 'Balcão', MESA: 'Mesa', SALAO: 'Salão', COMANDA: 'Comanda', DELIVERY: 'Delivery', IFOOD: 'iFood', '99FOOD': '99Food', PDV: 'PDV',
}

/** "Balcão · 54", "Mesa · 7", "Delivery" (a origem da venda e o atendimento de onde ela veio). */
export function origemDaVenda(origin: string | null | undefined, identificador: string | null | undefined): string {
    const chave = (origin ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
    const nome = NOMES_DA_ORIGEM[chave] ?? ((origin ?? '').trim() || 'Venda')
    const id = (identificador ?? '').trim()
    return id ? `${nome} · ${id}` : nome
}

/**
 * O número da venda para as pessoas: o do PDV quando o cancelamento o traz ("Venda #123"); senão os 8 primeiros caracteres
 * do código, o mesmo "#1f9408ee" dos lançamentos do caixa (a nuvem ainda não recebe o número da venda do PDV).
 */
export function numeroDaVenda(saleUuid: string | null | undefined, origemIdentificador?: string | null): string {
    const n = /#\s*(\d+)/.exec(origemIdentificador ?? '')
    if (n) return `#${n[1]}`
    return saleUuid ? `#${saleUuid.slice(0, 8)}` : '#?'
}

export function notaDoEstorno(origemIdentificador: string | null | undefined, saleUuid: string | null | undefined): string {
    return `Estorno da venda ${numeroDaVenda(saleUuid, origemIdentificador)}`
}

/** A escolha do operador na janela de cancelamento do PDV, normalizada (o PDV antigo não manda: nulo). */
export function destinoDoEstoque(d: string | null | undefined): 'ESTORNO' | 'DESPERDICIO' | null {
    const t = (d ?? '').trim().toUpperCase()
    return t === 'ESTORNO' || t === 'DESPERDICIO' ? t : null
}

// ─── Quem fez e de onde veio ───────────────────────────────────────────────────────────────────────────────────────────

/** Quem fez: o usuário gravado; da venda, o operador do caixa (e o vendedor, se for outro); da perda da venda, quem cancelou. */
export function quemFez(linha: Pick<LinhaDoEstoque, 'user_name' | 'description' | 'operation'>, venda?: VendaDaLinha | null, cancelamento?: CancelamentoDaLinha | null): string | null {
    if (linha.user_name) return linha.user_name
    if (linha.description === 'VENDA' && venda) {
        if (venda.status === 'CANCELLED' && !venda.estornado && cancelamento?.user_name) return `${cancelamento.user_name} (cancelou)`
        const partes = [venda.operador ? `${venda.operador} (caixa)` : null]
        if (venda.vendedor && venda.vendedor !== venda.operador) partes.push(`${venda.vendedor} (vendedor)`)
        const texto = partes.filter(Boolean).join(' · ')
        return texto || null
    }
    return null
}

export interface OrigemDoMovimento {
    tipo: 'VENDA' | 'NFE'
    id: string
    rotulo: string
}

/** O detalhe da linha (o que aconteceu) e o toque que abre a venda ou a nota de compra. */
export function detalheDoMovimento(
    linha: LinhaDoEstoque,
    venda?: VendaDaLinha | null,
    cancelamento?: CancelamentoDaLinha | null,
    fornecedor?: string | null,
): { detalhe: string; origem: OrigemDoMovimento | null } {
    const d = linha.description ?? ''
    if (d === 'VENDA' && venda) {
        const numero = numeroDaVenda(venda.id, cancelamento?.origin_identifier)
        const onde = origemDaVenda(venda.origin, venda.origin_identifier)
        const texto = venda.status === 'CANCELLED' && !venda.estornado
            ? `Venda ${numero} cancelada · ${cancelamento?.stock_destination === 'DESPERDICIO' ? 'desperdício' : 'não voltou ao estoque'}${cancelamento?.reason ? ` · ${cancelamento.reason}` : ''}`
            : `Venda ${numero} · ${onde}${venda.status === 'CANCELLED' ? ' (cancelada)' : ''}`
        return { detalhe: texto, origem: { tipo: 'VENDA', id: venda.id, rotulo: `Ver venda ${numero}` } }
    }
    if (d === 'DEVOLUCAO' && venda) {
        const texto = linha.note || `Estorno da venda ${numeroDaVenda(venda.id, cancelamento?.origin_identifier)}`
        return {
            detalhe: cancelamento?.reason ? `${texto} · ${cancelamento.reason}` : texto,
            origem: { tipo: 'VENDA', id: venda.id, rotulo: `Ver venda ${numeroDaVenda(venda.id, cancelamento?.origin_identifier)}` },
        }
    }
    if (d === 'COMPRA' && (linha.document_key || linha.document_number)) {
        const numero = linha.document_number ? `NF-e ${linha.document_number}` : 'NF-e'
        return {
            detalhe: [numero, fornecedor].filter(Boolean).join(' · '),
            origem: linha.document_key ? { tipo: 'NFE', id: linha.document_key, rotulo: `Ver ${numero}` } : null,
        }
    }
    const partes = [linha.note, linha.batch_number && !linha.note ? `Lote ${linha.batch_number}` : null].filter(Boolean)
    return { detalhe: partes.join(' · ') || '—', origem: null }
}

// ─── Saldo antes e depois ──────────────────────────────────────────────────────────────────────────────────────────────

const arredondar = (v: number) => Math.round((v + Number.EPSILON) * 10000) / 10000

export function chaveDoItem(l: Pick<LinhaDoEstoque, 'product_id' | 'supply_id'>): string | null {
    return l.product_id ? `P:${l.product_id}` : l.supply_id ? `S:${l.supply_id}` : null
}

export function deltaDoMovimento(l: Pick<LinhaDoEstoque, 'operation' | 'quantity'>): number {
    return l.operation === 'IN' ? l.quantity : -l.quantity
}

export interface SaldoDaLinha { antes: number | null; depois: number | null; calculado: boolean }

/**
 * Saldo antes e depois de cada movimento. As linhas vêm do MAIS NOVO para o mais velho (data e código), de um ou mais itens.
 * O saldo gravado na linha (a partir de 16/10/2026) manda; sem ele (movimento antigo), o saldo é calculado para trás a
 * partir do mais próximo conhecido acima dele: o gravado de um movimento mais novo ou o saldo atual do cadastro.
 */
export function saldosDoHistorico(
    linhasDoMaisNovo: Pick<LinhaDoEstoque, 'id' | 'product_id' | 'supply_id' | 'operation' | 'quantity' | 'balance_after'>[],
    saldoAtual: Map<string, number | null>,
): Map<string, SaldoDaLinha> {
    const ancora = new Map<string, number | null>(saldoAtual)
    const saldos = new Map<string, SaldoDaLinha>()
    for (const l of linhasDoMaisNovo) {
        const chave = chaveDoItem(l)
        if (!chave) { saldos.set(l.id, { antes: null, depois: null, calculado: true }); continue }
        const gravado = typeof l.balance_after === 'number' && Number.isFinite(l.balance_after)
        const depois = gravado ? l.balance_after! : (ancora.get(chave) ?? null)
        const antes = depois === null ? null : arredondar(depois - deltaDoMovimento(l))
        saldos.set(l.id, { antes, depois: depois === null ? null : arredondar(depois), calculado: !gravado })
        ancora.set(chave, antes)
    }
    return saldos
}

// ─── Unidade ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Unidade do item: a do insumo como foi cadastrada; o produto por peso é kg e o resto, un. */
export function unidadeDoItem(produto?: { measureUnit?: string | null } | null, insumo?: { unit?: string | null } | null): string {
    if (insumo) return (insumo.unit ?? '').trim() || 'un'
    return produto?.measureUnit === 'FRACTIONAL' ? 'kg' : 'un'
}
