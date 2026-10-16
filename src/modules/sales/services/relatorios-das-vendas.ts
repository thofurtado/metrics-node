import { normalizarNome } from '@/modules/cashier/services/plataformas'
import {
    type ContextoDasFormas,
    CONTEXTO_VAZIO,
    SEM_MAQUININHA,
    caixinhaDoLancamento,
    centavos,
    custoDoItem,
    maquininhaDoLancamento,
    margem,
    nomeDaForma,
    tipoDaForma,
    valorDoItem,
    vendaCancelada,
} from './conta-das-vendas'
import { chaveDoVendedor, nomeDoVendedor, origemDaVenda, type VendedorDoItem } from './filtros-das-vendas'

/**
 * Lista, detalhe, produtos vendidos, vendedores e cancelamentos do módulo Vendas (etapa 3; D2, D3 e D12 do Thomás, 16/10/2026).
 * Funções puras: recebem o que o banco devolveu e montam o que a web mostra. Venda antiga sem os dados novos = null ("—").
 * Custo e margem só vão para quem pode ver (veCusto; a regra de acesso de hoje, D9: as permissões ficam para depois).
 */

// ---------------------------------------------------------------------------------------------------------------
// Pequenos rótulos
// ---------------------------------------------------------------------------------------------------------------

/** O código curto da venda: os 8 primeiros caracteres, o mesmo do lançamento do caixa ("Pedido #1f9408ee"). */
export const codigoCurto = (id: string) => `#${id.slice(0, 8)}`

const SITUACOES_DA_NOTA: Record<string, string> = {
    SEM_NOTA: 'Sem nota',
    RECUSADA: 'Recusada',
    CONTINGENCIA: 'Em contingência',
    AUTORIZADA: 'Autorizada',
    CONTINGENCIA_RECUSADA: 'Contingência recusada',
    CANCELAMENTO_PENDENTE: 'Cancelamento pendente',
    CANCELADA: 'Cancelada',
    CANCELAMENTO_FALHOU: 'Cancelamento falhou',
}

/** A situação da nota em palavras (null = venda antiga, sem a nota na nuvem: "—"). */
export function situacaoDaNota(situacao: string | null | undefined): string | null {
    const s = (situacao ?? '').trim().toUpperCase()
    if (!s) return null
    return SITUACOES_DA_NOTA[s] ?? s
}

export interface CaixaDaVenda {
    id: string
    period?: string | null
    sequence_number?: number | null
    terminal_id?: string | null
    opened_at?: Date | string | null
    status?: string | null
    user_id?: string | null
}

/** "Turno 01" (o nome do caixa) e o computador do PDV (vazio = caixa aberto na web). */
export function rotuloDoCaixa(c: CaixaDaVenda | null | undefined): { id: string; nome: string; computador: string | null; abertoEm: string | null; status: string | null } | null {
    if (!c) return null
    const nome = (c.period ?? '').trim() || (c.sequence_number ? `Caixa ${String(c.sequence_number).padStart(2, '0')}` : 'Caixa')
    const abertoEm = c.opened_at ? new Date(c.opened_at).toISOString() : null
    return { id: c.id, nome, computador: (c.terminal_id ?? '').trim() || null, abertoEm, status: c.status ?? null }
}

// ---------------------------------------------------------------------------------------------------------------
// Lista venda a venda
// ---------------------------------------------------------------------------------------------------------------

export interface LancamentoDaVenda {
    id?: string
    amount: number
    payment_method: string | null
    bank?: string | null
    is_withdrawal?: boolean | null
    is_addition?: boolean | null
    is_tip?: boolean | null
    type?: string | null
    identification?: string | null
    sale_id?: string | null
    client_id?: string | null
    employee_id?: string | null
    platform_code?: string | null
    client?: { id: string; name: string } | null
    employee?: { id: string; name: string } | null
}

export interface VendaDaLista {
    id: string
    created_at: Date | string
    status: string
    total_amount: number
    discount?: number | null
    origin?: string | null
    origin_identifier?: string | null
    display_id?: number | null
    daily_number?: number | null
    nfce_status?: string | null
    nfce_number?: number | null
    nfce_series?: number | null
    cashierSession?: CaixaDaVenda | null
    client?: { id: string; name: string } | null
    entries?: LancamentoDaVenda[]
    _count?: { items?: number }
}

export interface CancelamentoDaVenda {
    id: string
    sale_id?: string | null
    item_id?: string | null
    product_id?: string | null
    product_name: string
    quantity: number | string | { toString(): string }
    unit_price?: number | string | { toString(): string } | null
    total_amount: number | string | { toString(): string }
    origin?: string | null
    origin_identifier?: string | null
    cancellation_type: string
    reason: string
    user_name?: string | null
    stock_restored?: boolean | null
    cancelled_at: Date | string
}

const numero = (v: unknown) => Number(typeof v === 'object' && v != null ? v.toString() : v) || 0

/** As formas de uma venda somadas (a venda com 2 Pix mostra um "PIX" só). */
export function formasDaVenda(entradas: LancamentoDaVenda[], ctx: ContextoDasFormas = CONTEXTO_VAZIO): { forma: string; valor: number }[] {
    const somas = new Map<string, number>()
    for (const l of entradas) {
        if (l.is_withdrawal || l.is_addition) continue
        const forma = nomeDaForma(l, tipoDaForma(l, ctx))
        somas.set(forma, (somas.get(forma) ?? 0) + (Number(l.amount) || 0))
    }
    return [...somas.entries()].map(([forma, valor]) => ({ forma, valor: centavos(valor) }))
}

/** A plataforma da venda pelos pagamentos (iFood/99 pago em dinheiro também traz o código). */
const plataformaDosLancamentos = (entradas: LancamentoDaVenda[]) => entradas.find(e => e.platform_code)?.platform_code ?? null

/** O cancelamento da venda inteira (o mais recente), quando houver. */
export function cancelamentoDaVenda(cancelamentos: CancelamentoDaVenda[]): { motivo: string; quem: string | null; quando: string } | null {
    const daVenda = cancelamentos
        .filter(c => ehDaVendaInteira(c.cancellation_type))
        .sort((a, b) => new Date(b.cancelled_at).getTime() - new Date(a.cancelled_at).getTime())[0]
    if (!daVenda) return null
    return { motivo: daVenda.reason, quem: (daVenda.user_name ?? '').trim() || null, quando: new Date(daVenda.cancelled_at).toISOString() }
}

/** Uma linha da lista "venda a venda" (D2): dia e hora, número/senha, origem, caixa, total, formas, nota e se foi cancelada. */
export function linhaDaVenda(v: VendaDaLista, cancelamentos: CancelamentoDaVenda[] = [], ctx: ContextoDasFormas = CONTEXTO_VAZIO) {
    const entradas = v.entries ?? []
    const cancelada = vendaCancelada(v)
    return {
        id: v.id,
        codigo: codigoCurto(v.id),
        numero: v.display_id ?? null,
        senha: v.daily_number ?? null,
        criadaEm: new Date(v.created_at).toISOString(),
        origem: origemDaVenda(v.origin, v.origin_identifier, plataformaDosLancamentos(entradas)),
        caixa: rotuloDoCaixa(v.cashierSession),
        cliente: v.client?.name ?? null,
        total: centavos(Number(v.total_amount) || 0),
        itens: v._count?.items ?? null,
        // A venda cancelada não tem pagamento na nuvem (os lançamentos saem no cancelamento): fica sem formas
        formas: cancelada ? [] : formasDaVenda(entradas, ctx),
        nota: v.nfce_status
            ? { situacao: v.nfce_status, rotulo: situacaoDaNota(v.nfce_status), numero: v.nfce_number ?? null, serie: v.nfce_series ?? null }
            : null,
        cancelada,
        cancelamento: cancelada ? cancelamentoDaVenda(cancelamentos) : null,
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Detalhe da venda (D3)
// ---------------------------------------------------------------------------------------------------------------

export interface ItemDoDetalhe extends VendedorDoItem {
    id: string
    product_id?: string | null
    sold_name?: string | null
    quantity: number
    unit_price: number
    discount?: number | null
    unit_cost?: number | null
    complements_cost?: number | null
    cost_source?: string | null
    complements?: unknown
    note?: string | null
    product?: { id: string; name: string; display_id?: number | null; measureUnit?: string | null } | null
}

export interface BaixaDoEstoque {
    id: string
    sale_item_id?: string | null
    product_id?: string | null
    supply_id?: string | null
    quantity: number
    operation: string
    description?: string | null
    unit_cost?: number | null
    created_at: Date | string
    product?: { id: string; name: string } | null
    supply?: { id: string; name: string } | null
}

export interface VendaDoDetalhe extends VendaDaLista {
    delivery_fee?: number | null
    service_fee?: number | null
    cover_charge?: number | null
    nfce_environment?: string | null
    nfce_key?: string | null
    nfce_contingency?: boolean | null
    nfce_reason?: string | null
    items?: ItemDoDetalhe[]
}

type Complemento = { grupo: string | null; nome: string; quantidade: number; preco: number; observacaoRapida: boolean }

/** As escolhas do item como a nuvem guardou (lista do PDV novo); qualquer outra coisa = null. */
export function complementosDoItem(bruto: unknown): Complemento[] | null {
    if (!Array.isArray(bruto)) return null
    const lista = bruto
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map(c => ({
            grupo: typeof c.grupo === 'string' ? c.grupo : null,
            nome: typeof c.nome === 'string' ? c.nome : '',
            quantidade: Number(c.quantidade) || 1,
            preco: Number(c.preco) || 0,
            observacaoRapida: c.observacaoRapida === true,
        }))
        .filter(c => c.nome.trim() !== '')
    return lista.length > 0 ? lista : null
}

/** O cancelamento é da venda inteira (e não de um item)? */
export const ehDaVendaInteira = (tipo: string) => ['VENDA_COMPLETA', 'VENDA_TOTAL', 'DELIVERY_CANCELADO', 'MESA_COMPLETA'].includes((tipo || '').toUpperCase())

export function linhaDoCancelamento(c: CancelamentoDaVenda) {
    return {
        id: c.id,
        vendaId: c.sale_id ?? null,
        itemId: c.item_id ?? null,
        tipo: c.cancellation_type,
        daVendaInteira: ehDaVendaInteira(c.cancellation_type),
        produto: c.product_name,
        produtoId: c.product_id ?? null,
        quantidade: numero(c.quantity),
        valor: centavos(numero(c.total_amount)),
        motivo: c.reason,
        quem: (c.user_name ?? '').trim() || null,
        quando: new Date(c.cancelled_at).toISOString(),
        origem: (c.origin_identifier ?? '').trim() || (c.origin ?? '').trim() || null,
        voltouAoEstoque: Boolean(c.stock_restored),
    }
}

/** O detalhe completo (D3): cabeçalho, valores, itens, pagamentos, nota, estoque e cancelamentos. */
export function detalheDaVenda(
    v: VendaDoDetalhe,
    extras: { baixas: BaixaDoEstoque[]; cancelamentos: CancelamentoDaVenda[]; operador: string | null },
    veCusto: boolean,
    ctx: ContextoDasFormas = CONTEXTO_VAZIO,
) {
    const base = linhaDaVenda(v, extras.cancelamentos, ctx)
    const entradas = (v.entries ?? []).filter(e => !e.is_withdrawal && !e.is_addition)

    const itens = (v.items ?? []).map(i => {
        const valor = valorDoItem(i)
        const custo = veCusto ? custoDoItem(i) : null
        const m = veCusto ? margem(valor, custo) : { valor: null, percentual: null }
        return {
            id: i.id,
            produtoId: i.product_id ?? null,
            codigo: i.product?.display_id ?? null,
            // Nome como foi vendido (PDV novo); venda antiga: o nome de hoje no cadastro
            nome: (i.sold_name ?? '').trim() || i.product?.name || 'Produto sem cadastro',
            nomeVendido: (i.sold_name ?? '').trim() || null,
            nomeNoCadastro: i.product?.name ?? null,
            unidade: i.product?.measureUnit === 'FRACTIONAL' ? 'kg' : 'un',
            quantidade: Number(i.quantity) || 0,
            precoUnitario: centavos(Number(i.unit_price) || 0),
            desconto: centavos(Number(i.discount) || 0),
            total: valor,
            complementos: complementosDoItem(i.complements),
            observacao: (i.note ?? '').trim() || null,
            vendedor: nomeDoVendedor(i) ? { nome: nomeDoVendedor(i), numero: i.seller_number ?? null, chave: chaveDoVendedor(i) } : null,
            custo,
            margem: m.valor,
            margemPercentual: m.percentual,
            cancelado: false,
        }
    })
    // Item cancelado (D12): aparece riscado no detalhe, pelo registro do cancelamento (o item saiu da venda no PDV)
    const idsDosItens = new Set(itens.map(i => i.id))
    const cancelamentos = extras.cancelamentos.map(linhaDoCancelamento)
    for (const c of cancelamentos) {
        if (c.daVendaInteira || (c.itemId && idsDosItens.has(c.itemId))) continue
        itens.push({
            id: c.id, produtoId: c.produtoId, codigo: null, nome: c.produto, nomeVendido: c.produto, nomeNoCadastro: null,
            unidade: 'un', quantidade: c.quantidade, precoUnitario: c.quantidade > 0 ? centavos(c.valor / c.quantidade) : c.valor,
            desconto: 0, total: c.valor, complementos: null, observacao: c.motivo, vendedor: null, custo: null, margem: null,
            margemPercentual: null, cancelado: true,
        })
    }

    const pagamentos = entradas.map(e => {
        const tipo = tipoDaForma(e, ctx)
        return {
            id: e.id ?? null,
            forma: nomeDaForma(e, tipo),
            formaOriginal: e.payment_method,
            tipo,
            valor: centavos(Number(e.amount) || 0),
            maquininha: tipo === 'DINHEIRO' ? null : maquininhaDoLancamento(e),
            semMaquininha: tipo !== 'DINHEIRO' && maquininhaDoLancamento(e) === SEM_MAQUININHA,
            // A prazo: de quem (cliente do fiado ou funcionário do consumo)
            pessoa: e.client?.name ?? e.employee?.name ?? null,
            caixinha: caixinhaDoLancamento(e),
            plataforma: e.platform_code ?? null,
        }
    })

    const nomeDaBaixa = (b: BaixaDoEstoque) => b.product?.name ?? b.supply?.name ?? 'Item do estoque'
    const estoque = extras.baixas.map(b => ({
        id: b.id,
        itemId: b.sale_item_id ?? null,
        nome: nomeDaBaixa(b),
        produtoId: b.product_id ?? null,
        insumoId: b.supply_id ?? null,
        ehInsumo: !b.product_id && !!b.supply_id,
        quantidade: Number(b.quantity) || 0,
        entrada: b.operation === 'IN',
        motivo: b.description ?? null,
        custoUnitario: veCusto && b.unit_cost != null ? b.unit_cost : null,
        quando: new Date(b.created_at).toISOString(),
    }))

    const custoTotal = veCusto && itens.some(i => !i.cancelado && i.custo != null)
        ? Math.round(itens.filter(i => !i.cancelado).reduce((s, i) => s + (i.custo ?? 0), 0) * 100) / 100
        : null
    const valorDosItens = centavos(itens.filter(i => !i.cancelado).reduce((s, i) => s + i.total, 0))

    return {
        ...base,
        operador: extras.operador,
        valores: {
            itens: valorDosItens,
            desconto: centavos(Number(v.discount) || 0),
            entrega: centavos(Number(v.delivery_fee) || 0),
            servico: centavos(Number(v.service_fee) || 0),
            couvert: centavos(Number(v.cover_charge) || 0),
            total: base.total,
            custo: custoTotal,
            margem: custoTotal == null ? null : centavos(valorDosItens - custoTotal),
        },
        itens,
        pagamentos,
        // O troco não sobe do PDV (o pagamento chega líquido, sem o troco)
        troco: null as number | null,
        caixinha: centavos(pagamentos.reduce((s, p) => s + p.caixinha, 0)),
        nota: v.nfce_status
            ? {
                situacao: v.nfce_status,
                rotulo: situacaoDaNota(v.nfce_status),
                numero: v.nfce_number ?? null,
                serie: v.nfce_series ?? null,
                ambiente: v.nfce_environment === 'H' ? 'Homologação' : v.nfce_environment === 'P' ? 'Produção' : null,
                chave: v.nfce_key ?? null,
                contingencia: v.nfce_contingency ?? null,
                motivo: v.nfce_reason ?? null,
            }
            : null,
        estoque,
        cancelamentos,
        veCusto,
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Produtos vendidos (D2, aba 3)
// ---------------------------------------------------------------------------------------------------------------

export interface ItemDoRelatorio extends VendedorDoItem {
    sale_id: string
    product_id?: string | null
    sold_name?: string | null
    quantity: number
    unit_price: number
    discount?: number | null
    unit_cost?: number | null
    complements_cost?: number | null
    product?: { id?: string; name: string; display_id?: number | null; measureUnit?: string | null } | null
}

const chaveDoProduto = (i: ItemDoRelatorio) =>
    i.product_id ? `p:${i.product_id}` : `n:${normalizarNome(i.sold_name) || 'sem nome'}`

const participacao = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 10000) / 100 : 0)

/**
 * Produto a produto no período: quantidade, faturamento (quantidade × preço − desconto do item), custo congelado na venda,
 * margem e participação no faturamento. Item sem custo congelado (venda antiga) entra no faturamento e fica fora da margem
 * (semCusto diz quantos). O desconto da venda (no total) e as taxas não são divididos entre os produtos: vão no rodapé.
 */
export function produtosVendidos(itens: ItemDoRelatorio[], veCusto: boolean) {
    type Linha = {
        chave: string; produtoId: string | null; codigo: number | null; nome: string; unidade: 'kg' | 'un'
        quantidade: number; faturamento: number; custo: number; faturamentoComCusto: number; semCusto: number; vendas: Set<string>
    }
    const porProduto = new Map<string, Linha>()
    for (const i of itens) {
        const chave = chaveDoProduto(i)
        const l = porProduto.get(chave) ?? {
            chave,
            produtoId: i.product_id ?? null,
            codigo: i.product?.display_id ?? null,
            nome: i.product?.name || (i.sold_name ?? '').trim() || 'Produto sem cadastro',
            unidade: i.product?.measureUnit === 'FRACTIONAL' ? 'kg' : 'un',
            quantidade: 0, faturamento: 0, custo: 0, faturamentoComCusto: 0, semCusto: 0, vendas: new Set<string>(),
        }
        const valor = valorDoItem(i)
        l.quantidade += Number(i.quantity) || 0
        l.faturamento += valor
        l.vendas.add(i.sale_id)
        const custo = custoDoItem(i)
        if (custo == null) l.semCusto += Number(i.quantity) || 0
        else { l.custo += custo; l.faturamentoComCusto += valor }
        porProduto.set(chave, l)
    }
    const faturamentoTotal = [...porProduto.values()].reduce((s, l) => s + l.faturamento, 0)
    const produtos = [...porProduto.values()]
        .map(l => {
            const temCusto = l.faturamentoComCusto > 0 || l.custo > 0
            const custo = veCusto && temCusto ? Math.round(l.custo * 100) / 100 : null
            const m = veCusto && temCusto ? margem(l.faturamentoComCusto, l.custo) : { valor: null, percentual: null }
            return {
                chave: l.chave,
                produtoId: l.produtoId,
                codigo: l.codigo,
                nome: l.nome,
                unidade: l.unidade,
                quantidade: Math.round(l.quantidade * 1000) / 1000,
                vendas: l.vendas.size,
                faturamento: centavos(l.faturamento),
                custo,
                margem: m.valor,
                margemPercentual: m.percentual,
                semCusto: veCusto ? Math.round(l.semCusto * 1000) / 1000 : null,
                participacao: participacao(l.faturamento, faturamentoTotal),
            }
        })
        .sort((a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome))

    const custoTotal = veCusto ? Math.round([...porProduto.values()].reduce((s, l) => s + l.custo, 0) * 100) / 100 : null
    const fatComCusto = [...porProduto.values()].reduce((s, l) => s + l.faturamentoComCusto, 0)
    const mTotal = veCusto && custoTotal != null ? margem(fatComCusto, custoTotal) : { valor: null, percentual: null }
    return {
        produtos,
        totais: {
            produtos: produtos.length,
            faturamento: centavos(faturamentoTotal),
            custo: custoTotal,
            margem: mTotal.valor,
            margemPercentual: mTotal.percentual,
            itensSemCusto: veCusto ? produtos.reduce((s, p) => s + (p.semCusto ?? 0), 0) : null,
        },
        veCusto,
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Vendedores (D2, aba 5)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Quanto cada vendedor vendeu no período, item por item (o vendedor é de cada item, D4): itens, faturamento, em quantas
 * vendas e os produtos dele. Item sem vendedor (venda antiga, loja que não pede o vendedor) fica em "Sem vendedor", no fim.
 */
export function vendedoresDoPeriodo(itens: ItemDoRelatorio[]) {
    type Linha = {
        chave: string; nome: string; numero: number | null; quantidade: number; faturamento: number; vendas: Set<string>
        produtos: Map<string, { nome: string; codigo: number | null; quantidade: number; faturamento: number }>
    }
    const porVendedor = new Map<string, Linha>()
    for (const i of itens) {
        const chave = chaveDoVendedor(i)
        const l = porVendedor.get(chave) ?? {
            chave, nome: nomeDoVendedor(i) ?? 'Sem vendedor', numero: i.seller_number ?? null,
            quantidade: 0, faturamento: 0, vendas: new Set<string>(), produtos: new Map(),
        }
        if (l.numero == null && i.seller_number) l.numero = i.seller_number
        const valor = valorDoItem(i)
        l.quantidade += Number(i.quantity) || 0
        l.faturamento += valor
        l.vendas.add(i.sale_id)
        const cp = chaveDoProduto(i)
        const p = l.produtos.get(cp) ?? { nome: i.product?.name || (i.sold_name ?? '').trim() || 'Produto sem cadastro', codigo: i.product?.display_id ?? null, quantidade: 0, faturamento: 0 }
        p.quantidade += Number(i.quantity) || 0
        p.faturamento += valor
        l.produtos.set(cp, p)
        porVendedor.set(chave, l)
    }
    const total = [...porVendedor.values()].reduce((s, l) => s + l.faturamento, 0)
    const vendedores = [...porVendedor.values()]
        .map(l => ({
            chave: l.chave,
            nome: l.nome,
            numero: l.numero,
            semVendedor: l.chave === 'sem',
            itens: Math.round(l.quantidade * 1000) / 1000,
            vendas: l.vendas.size,
            faturamento: centavos(l.faturamento),
            participacao: participacao(l.faturamento, total),
            produtos: [...l.produtos.values()]
                .map(p => ({ ...p, quantidade: Math.round(p.quantidade * 1000) / 1000, faturamento: centavos(p.faturamento) }))
                .sort((a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome)),
        }))
        .sort((a, b) => Number(a.semVendedor) - Number(b.semVendedor) || b.faturamento - a.faturamento)
    return { vendedores, totais: { faturamento: centavos(total), vendedores: vendedores.filter(v => !v.semVendedor).length } }
}

// ---------------------------------------------------------------------------------------------------------------
// Cancelamentos (D12, aba 4)
// ---------------------------------------------------------------------------------------------------------------

/** A lista de cancelamentos com os totais e as listas para os filtros (motivos e pessoas). */
export function relatorioDeCancelamentos(
    linhas: CancelamentoDaVenda[],
    vendas: Map<string, { display_id?: number | null; daily_number?: number | null; total_amount?: number | null; status?: string | null }>,
) {
    const lista = linhas
        .map(c => {
            const l = linhaDoCancelamento(c)
            const venda = l.vendaId ? vendas.get(l.vendaId) : undefined
            return {
                ...l,
                venda: l.vendaId && venda
                    ? { id: l.vendaId, codigo: codigoCurto(l.vendaId), numero: venda.display_id ?? null, senha: venda.daily_number ?? null }
                    : null,
            }
        })
        .sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())
    const motivos = [...new Set(lista.map(l => l.motivo.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    const pessoas = [...new Set(lista.map(l => l.quem).filter((q): q is string => !!q))].sort((a, b) => a.localeCompare(b))
    const voltaram = lista.filter(l => l.voltouAoEstoque)
    return {
        cancelamentos: lista,
        totais: {
            quantidade: lista.length,
            valor: centavos(lista.reduce((s, l) => s + l.valor, 0)),
            vendasInteiras: lista.filter(l => l.daVendaInteira).length,
            itens: lista.filter(l => !l.daVendaInteira).length,
            voltaramAoEstoque: voltaram.length,
            valorQueVoltou: centavos(voltaram.reduce((s, l) => s + l.valor, 0)),
        },
        motivos,
        pessoas,
    }
}
