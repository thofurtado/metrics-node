import { FastifyRequest, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    CancelamentoDaLinha,
    LinhaDoEstoque,
    SaldoDaLinha,
    VendaDaLinha,
    chaveDoItem,
    deltaDoMovimento,
    detalheDoMovimento,
    filtroDoTipo,
    intervaloDoPeriodo,
    numeroDaVenda,
    origemDaVenda,
    quemFez,
    saldosDoHistorico,
    tipoDoFiltro,
    tipoDoMovimento,
    unidadeDoItem,
} from '../../services/historico-do-estoque'

/**
 * Histórico do estoque (decisão D6 do Thomás, 16/10/2026): o extrato do Controle de Estoque › Histórico e a aba Histórico da
 * ficha do produto (Mercadorias) usam esta mesma consulta. Ver services/historico-do-estoque.ts para as regras.
 */

const LIMITE_DOS_TOTAIS = 20000

const filtrosSchema = z.object({
    period: z.string().optional().default('today'),
    from: z.string().optional(),
    to: z.string().optional(),
    eventType: z.string().optional(),
    query: z.string().optional(),
    itemId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(5000).default(50),
})
type Filtros = z.infer<typeof filtrosSchema>

const incluirNaLinha = {
    product: { select: { id: true, name: true, display_id: true, measureUnit: true, stock: true } },
    supply: { select: { id: true, name: true, unit: true, stock: true } },
    saleItem: {
        select: {
            id: true,
            quantity: true,
            sold_name: true,
            seller_name: true,
            sale: {
                select: {
                    id: true, status: true, origin: true, origin_identifier: true, created_at: true,
                    cashierSession: { select: { user_id: true } },
                },
            },
        },
    },
} satisfies Prisma.StockInclude

type LinhaComDetalhes = Prisma.StockGetPayload<{ include: typeof incluirNaLinha }>

export function filtroDoHistorico(f: Pick<Filtros, 'period' | 'from' | 'to' | 'eventType' | 'query' | 'itemId'>): Prisma.StockWhereInput {
    const e: Prisma.StockWhereInput[] = []
    const { inicio, fim } = intervaloDoPeriodo(f.period, f.from, f.to)
    if (inicio || fim) e.push({ created_at: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: fim } : {}) } })
    if (f.itemId) e.push({ OR: [{ product_id: f.itemId }, { supply_id: f.itemId }] })
    const doTipo = filtroDoTipo(tipoDoFiltro(f.eventType))
    if (doTipo) e.push(doTipo)
    const texto = (f.query ?? '').trim()
    if (texto) {
        const codigo = /^\d{1,9}$/.test(texto) ? Number(texto) : null
        e.push({
            OR: [
                { product: { name: { contains: texto, mode: 'insensitive' } } },
                { supply: { name: { contains: texto, mode: 'insensitive' } } },
                { note: { contains: texto, mode: 'insensitive' } },
                { document_number: { contains: texto } },
                ...(codigo !== null ? [{ product: { display_id: codigo } }] : []),
            ],
        })
    }
    return e.length > 0 ? { AND: e } : {}
}

async function nomesDosUsuarios(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const us = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    return new Map(us.map(u => [u.id, u.name]))
}

/** Lê o que cada linha da página precisa: venda (operador, vendedor, estorno), cancelamento, fornecedor e o saldo. */
async function montarLinhas(linhas: LinhaComDetalhes[]) {
    const itensVendidos = [...new Set(linhas.map(l => l.sale_item_id).filter((x): x is string => !!x))]
    const operadores = [...new Set(linhas.map(l => l.saleItem?.sale?.cashierSession?.user_id).filter((x): x is string => !!x))]
    const cnpjs = [...new Set(linhas.map(l => l.supplier_cnpj).filter((x): x is string => !!x))]

    const [nomes, estornos, cancelamentos, fornecedores] = await Promise.all([
        nomesDosUsuarios(operadores),
        itensVendidos.length > 0
            ? prisma.stock.findMany({ where: { sale_item_id: { in: itensVendidos }, operation: 'IN' }, select: { sale_item_id: true } })
            : Promise.resolve([] as { sale_item_id: string | null }[]),
        itensVendidos.length > 0
            ? prisma.cancellationAudit.findMany({
                where: { item_id: { in: itensVendidos } },
                orderBy: { cancelled_at: 'desc' },
                select: { item_id: true, reason: true, user_name: true, stock_destination: true, cancelled_at: true, origin_identifier: true },
            })
            : Promise.resolve([] as any[]),
        cnpjs.length > 0
            ? prisma.supplierProductMapping.findMany({ where: { supplier_cnpj: { in: cnpjs } }, select: { supplier_cnpj: true, supplier_name: true } })
            : Promise.resolve([] as { supplier_cnpj: string; supplier_name: string | null }[]),
    ])
    const estornados = new Set(estornos.map(e => e.sale_item_id))
    const cancelamentoDoItem = new Map<string, CancelamentoDaLinha>()
    for (const c of cancelamentos) if (c.item_id && !cancelamentoDoItem.has(c.item_id)) cancelamentoDoItem.set(c.item_id, c)
    const nomeDoFornecedor = new Map<string, string>()
    for (const f of fornecedores) if (f.supplier_name && !nomeDoFornecedor.has(f.supplier_cnpj)) nomeDoFornecedor.set(f.supplier_cnpj, f.supplier_name)

    // Saldo antes e depois: os movimentos dos mesmos itens desde o mais velho da página, do mais novo para o mais velho
    const produtos = [...new Set(linhas.map(l => l.product_id).filter((x): x is string => !!x))]
    const insumos = [...new Set(linhas.map(l => l.supply_id).filter((x): x is string => !!x))]
    const saldoAtual = new Map<string, number | null>()
    for (const l of linhas) {
        const chave = chaveDoItem(l)
        if (chave && !saldoAtual.has(chave)) saldoAtual.set(chave, l.product?.stock ?? l.supply?.stock ?? null)
    }
    let saldos = new Map<string, SaldoDaLinha>()
    if (linhas.length > 0 && (produtos.length > 0 || insumos.length > 0)) {
        const maisVelha = linhas.reduce((m, l) => (l.created_at < m ? l.created_at : m), linhas[0].created_at)
        const doItem: Prisma.StockWhereInput[] = []
        if (produtos.length > 0) doItem.push({ product_id: { in: produtos } })
        if (insumos.length > 0) doItem.push({ supply_id: { in: insumos } })
        const caminho = await prisma.stock.findMany({
            where: { AND: [{ OR: doItem }, { created_at: { gte: maisVelha } }] },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            select: { id: true, product_id: true, supply_id: true, operation: true, quantity: true, balance_after: true },
        })
        saldos = saldosDoHistorico(caminho, saldoAtual)
    }

    return linhas.map(l => {
        const venda: VendaDaLinha | null = l.saleItem?.sale
            ? {
                id: l.saleItem.sale.id,
                status: l.saleItem.sale.status,
                origin: l.saleItem.sale.origin,
                origin_identifier: l.saleItem.sale.origin_identifier,
                operador: l.saleItem.sale.cashierSession?.user_id ? nomes.get(l.saleItem.sale.cashierSession.user_id) ?? null : null,
                vendedor: l.saleItem.seller_name ?? null,
                estornado: estornados.has(l.saleItem.id),
            }
            : null
        const cancelamento = l.sale_item_id ? cancelamentoDoItem.get(l.sale_item_id) ?? null : null
        const linha = l as unknown as LinhaDoEstoque
        const { tipo, rotulo } = tipoDoMovimento(linha, venda)
        const { detalhe, origem } = detalheDoMovimento(linha, venda, cancelamento, l.supplier_cnpj ? nomeDoFornecedor.get(l.supplier_cnpj) ?? null : null)
        const saldo = saldos.get(l.id) ?? { antes: null, depois: null, calculado: true }
        const unidade = unidadeDoItem(l.product, l.supply)
        return {
            id: l.id,
            date: l.created_at,
            item: {
                id: l.product_id ?? l.supply_id,
                type: l.product_id ? 'PRODUCT' : l.supply_id ? 'SUPPLY' : null,
                name: l.product?.name ?? l.supply?.name ?? 'Item apagado',
                code: l.product?.display_id ?? null,
                unit: unidade,
            },
            kind: tipo,
            label: rotulo,
            operation: l.operation,
            quantity: l.quantity,
            delta: deltaDoMovimento(l),
            balanceBefore: saldo.antes,
            balanceAfter: saldo.depois,
            balanceCalculated: saldo.calculado,
            unitCost: l.unit_cost,
            totalValue: l.unit_cost !== null && l.unit_cost !== undefined ? Number((l.quantity * l.unit_cost).toFixed(2)) : null,
            who: quemFez(linha, venda, cancelamento),
            detail: detalhe,
            origin: origem,
            soldName: l.saleItem?.sold_name ?? null,
        }
    })
}

export type LinhaDoHistoricoDto = Awaited<ReturnType<typeof montarLinhas>>[number]

async function totaisDoFiltro(where: Prisma.StockWhereInput, total: number) {
    if (total > LIMITE_DOS_TOTAIS) return { entradas: null, saidas: null }
    const linhas = await prisma.stock.findMany({ where, select: { operation: true, quantity: true, unit_cost: true } })
    let entradas = 0
    let saidas = 0
    for (const m of linhas) {
        const v = (m.quantity || 0) * (m.unit_cost || 0)
        if (m.operation === 'IN') entradas += v
        else saidas += v
    }
    return { entradas: Number(entradas.toFixed(2)), saidas: Number(saidas.toFixed(2)) }
}

async function cabecalhoDoItem(itemId: string | undefined) {
    if (!itemId) return null
    const p = await prisma.product.findUnique({ where: { id: itemId }, select: { id: true, name: true, display_id: true, measureUnit: true, stock: true, is_composite: true, compositions: { select: { id: true } } } })
    if (p) {
        return {
            id: p.id, type: 'PRODUCT' as const, name: p.name, code: p.display_id, unit: unidadeDoItem(p, null), currentStock: p.stock ?? 0,
            // Produto com ficha técnica: quem baixa são os insumos da ficha, não ele (D8)
            hasRecipe: p.is_composite && p.compositions.length > 0,
        }
    }
    const s = await prisma.supply.findUnique({ where: { id: itemId }, select: { id: true, name: true, unit: true, stock: true } })
    if (s) return { id: s.id, type: 'SUPPLY' as const, name: s.name, code: null, unit: unidadeDoItem(null, s), currentStock: s.stock ?? 0, hasRecipe: false }
    return null
}

async function responderHistorico(f: Filtros, reply: FastifyReply) {
    const where = filtroDoHistorico(f)
    const [total, linhas, item] = await Promise.all([
        prisma.stock.count({ where }),
        prisma.stock.findMany({
            where,
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: (f.page - 1) * f.perPage,
            take: f.perPage,
            include: incluirNaLinha,
        }),
        cabecalhoDoItem(f.itemId),
    ])
    if (f.itemId && !item) return reply.status(404).send({ message: 'Produto ou insumo não encontrado.' })
    const [movimentos, totais] = await Promise.all([montarLinhas(linhas), totaisDoFiltro(where, total)])
    return reply.send({
        item,
        movements: movimentos,
        summary: {
            totalCount: total,
            totalEntriesValue: totais.entradas,
            totalExitsValue: totais.saidas,
            page: f.page,
            perPage: f.perPage,
            totalPages: Math.max(1, Math.ceil(total / f.perPage)),
        },
    })
}

/** GET /api/stock/movements — extrato do Controle de Estoque › Histórico (com filtro por produto, tipo, período e texto). */
export async function getStockMovements(request: FastifyRequest, reply: FastifyReply) {
    return responderHistorico(filtrosSchema.parse(request.query), reply)
}

/** GET /items/:id/stock-history — aba Histórico da ficha do produto ou do insumo (Mercadorias). Padrão: todo o período. */
export async function getItemStockHistory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const q = filtrosSchema.omit({ itemId: true }).extend({ period: z.string().optional().default('all') }).parse(request.query)
    return responderHistorico({ ...q, itemId: id }, reply)
}

/** GET /api/stock/items?query= — procura de produto ou insumo para o filtro do histórico (no máximo 20 de cada). */
export async function getStockItemsSearch(request: FastifyRequest, reply: FastifyReply) {
    const { query } = z.object({ query: z.string().optional().default('') }).parse(request.query)
    const texto = query.trim()
    if (texto.length < 2 && !/^\d+$/.test(texto)) return reply.send({ items: [] })
    const codigo = /^\d{1,9}$/.test(texto) ? Number(texto) : null
    const [produtos, insumos] = await Promise.all([
        prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: texto, mode: 'insensitive' } },
                    { barcode: texto },
                    ...(codigo !== null ? [{ display_id: codigo }] : []),
                ],
            },
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
            take: 20,
            select: { id: true, name: true, display_id: true, measureUnit: true, stock: true, active: true },
        }),
        prisma.supply.findMany({
            where: { name: { contains: texto, mode: 'insensitive' } },
            orderBy: { name: 'asc' },
            take: 20,
            select: { id: true, name: true, unit: true, stock: true, active: true },
        }),
    ])
    return reply.send({
        items: [
            ...insumos.map(s => ({ id: s.id, type: 'SUPPLY' as const, name: s.name, code: null, unit: unidadeDoItem(null, s), currentStock: s.stock ?? 0, active: s.active !== false })),
            ...produtos.map(p => ({ id: p.id, type: 'PRODUCT' as const, name: p.name, code: p.display_id, unit: unidadeDoItem(p, null), currentStock: p.stock ?? 0, active: p.active !== false })),
        ],
    })
}

/**
 * GET /api/stock/origin?type=VENDA|NFE&id= — o toque na linha do histórico: a venda (itens, pagamentos, cancelamentos e as
 * baixas de estoque dela) ou a nota de compra (fornecedor, quem deu entrada e o que entrou).
 */
export async function getStockOrigin(request: FastifyRequest, reply: FastifyReply) {
    const { type, id } = z.object({ type: z.enum(['VENDA', 'NFE']), id: z.string().min(1).max(80) }).parse(request.query)

    if (type === 'VENDA') {
        const venda = await prisma.sale.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { select: { name: true, display_id: true, measureUnit: true } },
                        stocks: {
                            orderBy: { created_at: 'asc' },
                            include: { product: { select: { name: true, measureUnit: true } }, supply: { select: { name: true, unit: true } } },
                        },
                    },
                },
                entries: { select: { payment_method: true, amount: true, bank: true } },
                cashierSession: { select: { user_id: true, period: true, sequence_number: true, terminal_id: true, opened_at: true } },
            },
        })
        if (!venda) return reply.status(404).send({ message: 'Venda não encontrada na nuvem.' })
        const [operadores, cancelamentos] = await Promise.all([
            nomesDosUsuarios(venda.cashierSession?.user_id ? [venda.cashierSession.user_id] : []),
            prisma.cancellationAudit.findMany({
                where: { sale_id: id },
                orderBy: { cancelled_at: 'asc' },
                select: { product_name: true, quantity: true, reason: true, user_name: true, stock_destination: true, cancelled_at: true, origin_identifier: true, cancellation_type: true },
            }),
        ])
        const numero = numeroDaVenda(venda.id, cancelamentos[0]?.origin_identifier)
        return reply.send({
            type: 'VENDA',
            sale: {
                id: venda.id,
                number: numero,
                date: venda.created_at,
                status: venda.status,
                origin: origemDaVenda(venda.origin, venda.origin_identifier),
                total: venda.total_amount,
                discount: venda.discount ?? 0,
                deliveryFee: venda.delivery_fee ?? 0,
                serviceFee: venda.service_fee ?? 0,
                coverCharge: venda.cover_charge ?? 0,
                cashier: venda.cashierSession
                    ? { name: `${venda.cashierSession.period} · nº ${venda.cashierSession.sequence_number}`, terminal: venda.cashierSession.terminal_id, operator: venda.cashierSession.user_id ? operadores.get(venda.cashierSession.user_id) ?? null : null }
                    : null,
                items: venda.items.map(i => ({
                    id: i.id,
                    name: i.sold_name || i.product?.name || 'Item sem produto',
                    code: i.product?.display_id ?? null,
                    quantity: i.quantity,
                    unit: unidadeDoItem(i.product, null),
                    unitPrice: i.unit_price,
                    discount: i.discount ?? 0,
                    seller: i.seller_name,
                    stock: i.stocks.map(s => ({
                        id: s.id,
                        name: s.product?.name ?? s.supply?.name ?? 'Item apagado',
                        unit: unidadeDoItem(s.product, s.supply),
                        operation: s.operation,
                        quantity: s.quantity,
                        kind: tipoDoMovimento(s as unknown as LinhaDoEstoque, null).rotulo,
                        date: s.created_at,
                    })),
                })),
                payments: venda.entries.map(e => ({ method: e.payment_method, amount: e.amount, machine: e.bank })),
                cancellations: cancelamentos.map(c => ({
                    item: c.product_name, quantity: c.quantity, reason: c.reason, who: c.user_name, when: c.cancelled_at,
                    stock: c.stock_destination === 'ESTORNO' ? 'Voltou ao estoque' : c.stock_destination === 'DESPERDICIO' ? 'Desperdício' : null,
                })),
            },
        })
    }

    const linhas = await prisma.stock.findMany({
        where: { document_key: id },
        orderBy: { created_at: 'asc' },
        include: { product: { select: { name: true, display_id: true, measureUnit: true } }, supply: { select: { name: true, unit: true } } },
    })
    if (linhas.length === 0) return reply.status(404).send({ message: 'Nota de compra não encontrada no estoque.' })
    const cnpj = linhas[0].supplier_cnpj
    const fornecedor = cnpj
        ? await prisma.supplierProductMapping.findFirst({ where: { supplier_cnpj: cnpj, supplier_name: { not: null } }, select: { supplier_name: true } })
        : null
    return reply.send({
        type: 'NFE',
        invoice: {
            key: id,
            number: linhas[0].document_number,
            supplier: { cnpj, name: fornecedor?.supplier_name ?? null },
            date: linhas[0].created_at,
            who: linhas[0].user_name,
            items: linhas.map(l => ({
                id: l.id,
                name: l.product?.name ?? l.supply?.name ?? 'Item apagado',
                unit: unidadeDoItem(l.product, l.supply),
                quantity: l.quantity,
                unitCost: l.unit_cost,
                total: l.unit_cost !== null ? Number((l.quantity * l.unit_cost).toFixed(2)) : null,
                kind: tipoDoMovimento(l as unknown as LinhaDoEstoque, null).rotulo,
                batch: l.batch_number,
            })),
        },
    })
}
