import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { normalizarNome } from '@/modules/cashier/services/plataformas'
import {
    acessoDoUsuario,
    carregarConta,
    carregarItensVendidos,
    contextoDasFormas,
    ondeOsLancamentos,
} from '../../services/consultas-das-vendas'
import { FiltroInvalido, ORIGENS, chaveDoVendedor, intervaloDosDias, nomeDoVendedor, ondeAsVendas } from '../../services/filtros-das-vendas'
import {
    detalheDaVenda,
    ehDaVendaInteira,
    linhaDaVenda,
    produtosVendidos,
    relatorioDeCancelamentos,
    rotuloDoCaixa,
    vendedoresDoPeriodo,
} from '../../services/relatorios-das-vendas'

/**
 * Rotas do módulo Vendas (etapas 2 e 3, 16/10/2026; ESPEC-VENDAS-E-ESTOQUE.md). Todas só leem: nada aqui grava no banco.
 * Protegidas como a Conferência de caixa (login + módulo Caixa ou Financeiro, em routes.ts).
 *
 *   GET /api/vendas/conta          a conta única (D11): Total vendido × Total recebido e a linha da diferença
 *   GET /api/vendas                a lista venda a venda, paginada (D2, aba 1)
 *   GET /api/vendas/:id            o detalhe completo da venda (D3)
 *   GET /api/vendas/produtos       produtos vendidos no período (aba 3)
 *   GET /api/vendas/cancelamentos  vendas e itens cancelados (aba 4, D12)
 *   GET /api/vendas/vendedores     quanto cada vendedor vendeu, item por item (aba 5)
 *   GET /api/vendas/filtros        as listas dos filtros (caixas, formas e vendedores do período)
 */

const texto = z.string().trim().max(200).optional().nullable()

const periodoSchema = z.object({
    de: z.string().trim().optional().nullable(),
    ate: z.string().trim().optional().nullable(),
    caixa: z.string().uuid().optional().nullable(),
})

const filtrosSchema = periodoSchema.extend({
    origem: texto,
    forma: texto,
    vendedor: texto,
    produto: texto,
    busca: texto,
    situacao: z.enum(['todas', 'concluidas', 'canceladas']).optional().nullable(),
})

type Consulta = z.infer<typeof filtrosSchema>

const usuarioDa = (request: FastifyRequest) => (request.user as { sub?: string } | undefined)?.sub ?? null

/** O período dos filtros: só o caixa (sem datas) = o caixa inteiro; sem nada = hoje (dia operacional). */
function periodoDa(q: z.infer<typeof periodoSchema>) {
    if (q.caixa && !q.de && !q.ate) return null
    return intervaloDosDias(q.de, q.ate)
}

async function responder(reply: FastifyReply, trabalho: () => Promise<unknown>) {
    try {
        return reply.status(200).send(await trabalho())
    } catch (err) {
        if (err instanceof FiltroInvalido) return reply.status(400).send({ message: err.message })
        throw err
    }
}

async function filtroDa(request: FastifyRequest, q: Consulta) {
    const acesso = await acessoDoUsuario(prisma, usuarioDa(request))
    const periodo = periodoDa(q)
    return {
        acesso,
        periodo,
        filtro: {
            periodo: periodo ? { inicio: periodo.inicio, fim: periodo.fim } : null,
            caixaId: q.caixa ?? null,
            origem: q.origem ?? null,
            forma: q.forma ?? null,
            vendedor: q.vendedor ?? null,
            produto: q.produto ?? null,
            busca: q.busca ?? null,
            situacao: q.situacao ?? null,
            soDoOperador: acesso.soDoOperador,
        },
    }
}

const periodoNaResposta = (p: ReturnType<typeof periodoDa>) => (p ? { de: p.de, ate: p.ate } : null)

/** GET /api/vendas/conta?de&ate&caixa — a conta única (D11). */
export async function getContaDasVendas(request: FastifyRequest, reply: FastifyReply) {
    const q = periodoSchema.parse(request.query)
    return responder(reply, async () => {
        const { filtro, periodo } = await filtroDa(request, q)
        const conta = await carregarConta(prisma, filtro)
        return { periodo: periodoNaResposta(periodo), caixa: q.caixa ?? null, conta }
    })
}

const listaSchema = filtrosSchema.extend({
    pagina: z.coerce.number().int().min(1).optional().default(1),
    porPagina: z.coerce.number().int().min(1).max(500).optional().default(50),
})

/** GET /api/vendas — a lista venda a venda, paginada, com os filtros (D2). A cancelada continua na lista (D12). */
export async function getListaDeVendas(request: FastifyRequest, reply: FastifyReply) {
    const q = listaSchema.parse(request.query)
    return responder(reply, async () => {
        const { filtro, periodo } = await filtroDa(request, q)
        const where = ondeAsVendas(filtro)
        const [total, ativas, vendas, ctx] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.aggregate({ where: { AND: [where, { NOT: { status: 'CANCELLED' } }] }, _sum: { total_amount: true }, _count: { _all: true } }),
            prisma.sale.findMany({
                where,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                skip: (q.pagina - 1) * q.porPagina,
                take: q.porPagina,
                select: {
                    id: true, created_at: true, status: true, total_amount: true, discount: true, origin: true, origin_identifier: true,
                    display_id: true, daily_number: true, nfce_status: true, nfce_number: true, nfce_series: true,
                    cashierSession: { select: { id: true, period: true, sequence_number: true, terminal_id: true, opened_at: true, status: true } },
                    client: { select: { id: true, name: true } },
                    entries: {
                        where: { is_withdrawal: false, is_addition: false },
                        select: { amount: true, payment_method: true, bank: true, platform_code: true, is_tip: true, type: true, identification: true, client_id: true, employee_id: true },
                    },
                    _count: { select: { items: true } },
                },
            }),
            contextoDasFormas(prisma),
        ])
        const canceladas = vendas.filter(v => v.status === 'CANCELLED').map(v => v.id)
        const cancelamentos = canceladas.length > 0
            ? await prisma.cancellationAudit.findMany({ where: { sale_id: { in: canceladas } } })
            : []
        const quantasAtivas = ativas._count?._all ?? 0
        return {
            periodo: periodoNaResposta(periodo),
            pagina: q.pagina,
            porPagina: q.porPagina,
            total,
            totais: {
                vendas: quantasAtivas,
                canceladas: Math.max(0, total - quantasAtivas),
                // Fora as canceladas (D12)
                valor: Math.round((Number(ativas._sum?.total_amount) || 0) * 100) / 100,
            },
            vendas: vendas.map(v => linhaDaVenda(v, cancelamentos.filter(c => c.sale_id === v.id), ctx)),
        }
    })
}

/** GET /api/vendas/:id — o detalhe completo (D3). */
export async function getDetalheDaVenda(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const acesso = await acessoDoUsuario(prisma, usuarioDa(request))
    const venda = await prisma.sale.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: { select: { id: true, name: true, display_id: true, measureUnit: true } },
                    seller: { select: { name: true } },
                },
            },
            entries: {
                include: { client: { select: { id: true, name: true } }, employee: { select: { id: true, name: true } } },
                orderBy: { created_at: 'asc' },
            },
            cashierSession: true,
            client: { select: { id: true, name: true } },
        },
    })
    // O operador de caixa só vê as vendas dos caixas dele (como na lista)
    if (!venda || (acesso.soDoOperador && venda.cashierSession?.user_id !== acesso.soDoOperador)) {
        return reply.status(404).send({ message: 'Venda não encontrada.' })
    }
    const idsDosItens = venda.items.map(i => i.id)
    const [baixas, cancelamentos, operador, ctx] = await Promise.all([
        idsDosItens.length > 0
            ? prisma.stock.findMany({
                where: { sale_item_id: { in: idsDosItens } },
                include: { product: { select: { id: true, name: true } }, supply: { select: { id: true, name: true } } },
                orderBy: { created_at: 'asc' },
            })
            : Promise.resolve([]),
        prisma.cancellationAudit.findMany({ where: { OR: [{ sale_id: id }, { order_id: id }] }, orderBy: { cancelled_at: 'asc' } }),
        venda.cashierSession?.user_id
            ? prisma.user.findUnique({ where: { id: venda.cashierSession.user_id }, select: { name: true } })
            : Promise.resolve(null),
        contextoDasFormas(prisma),
    ])
    return reply.status(200).send(detalheDaVenda(venda, { baixas, cancelamentos, operador: operador?.name ?? null }, acesso.veCusto, ctx))
}

/** GET /api/vendas/produtos — produto a produto no período (filtros: origem, caixa, vendedor). */
export async function getProdutosVendidos(request: FastifyRequest, reply: FastifyReply) {
    const q = filtrosSchema.parse(request.query)
    return responder(reply, async () => {
        const { filtro, periodo, acesso } = await filtroDa(request, q)
        const [itens, conta] = await Promise.all([
            carregarItensVendidos(prisma, filtro),
            // O rodapé do relatório: os itens somam com os descontos e as taxas no Total vendido (a conta única)
            carregarConta(prisma, filtro),
        ])
        return { periodo: periodoNaResposta(periodo), ...produtosVendidos(itens, acesso.veCusto), conta }
    })
}

/** GET /api/vendas/vendedores — quanto cada vendedor vendeu no período, item por item. */
export async function getVendedoresDoPeriodo(request: FastifyRequest, reply: FastifyReply) {
    const q = filtrosSchema.parse(request.query)
    return responder(reply, async () => {
        const { filtro, periodo } = await filtroDa(request, q)
        const itens = await carregarItensVendidos(prisma, filtro)
        return { periodo: periodoNaResposta(periodo), ...vendedoresDoPeriodo(itens) }
    })
}

const cancelamentosSchema = z.object({
    de: z.string().trim().optional().nullable(),
    ate: z.string().trim().optional().nullable(),
    motivo: texto,
    pessoa: texto,
    tipo: z.enum(['todos', 'vendas', 'itens']).optional().nullable(),
})

/** GET /api/vendas/cancelamentos — vendas e itens cancelados no período, com motivo, quem, quando e se voltou ao estoque. */
export async function getCancelamentosDasVendas(request: FastifyRequest, reply: FastifyReply) {
    const q = cancelamentosSchema.parse(request.query)
    return responder(reply, async () => {
        const periodo = intervaloDosDias(q.de, q.ate)
        const acesso = await acessoDoUsuario(prisma, usuarioDa(request))
        const linhas = await prisma.cancellationAudit.findMany({
            where: { cancelled_at: { gte: periodo.inicio, lt: periodo.fim } },
            orderBy: { cancelled_at: 'desc' },
        })
        const idsDasVendas = [...new Set(linhas.map(l => l.sale_id).filter((s): s is string => !!s))]
        const vendas = idsDasVendas.length > 0
            ? await prisma.sale.findMany({
                where: { id: { in: idsDasVendas } },
                select: { id: true, display_id: true, daily_number: true, total_amount: true, status: true, cashierSession: { select: { user_id: true } } },
            })
            : []
        const porId = new Map(vendas.map(v => [v.id, v]))
        // O operador de caixa só vê os cancelamentos das vendas dos caixas dele
        const visiveis = acesso.soDoOperador
            ? linhas.filter(l => l.sale_id && porId.get(l.sale_id)?.cashierSession?.user_id === acesso.soDoOperador)
            : linhas
        // Filtros por motivo, pessoa e tipo; as listas dos filtros (motivos e pessoas) são as do período inteiro
        const motivo = normalizarNome(q.motivo)
        const pessoa = normalizarNome(q.pessoa)
        const filtradas = visiveis.filter(l =>
            (!motivo || normalizarNome(l.reason).includes(motivo))
            && (!pessoa || normalizarNome(l.user_name) === pessoa)
            && (!q.tipo || q.tipo === 'todos' || (q.tipo === 'vendas') === ehDaVendaInteira(l.cancellation_type)))
        const todos = relatorioDeCancelamentos(visiveis, porId)
        const resumo = relatorioDeCancelamentos(filtradas, porId)
        return { periodo: { de: periodo.de, ate: periodo.ate }, ...resumo, motivos: todos.motivos, pessoas: todos.pessoas }
    })
}

/** GET /api/vendas/filtros — caixas, formas e vendedores do período, para as listas dos filtros. */
export async function getFiltrosDasVendas(request: FastifyRequest, reply: FastifyReply) {
    const q = periodoSchema.parse(request.query)
    return responder(reply, async () => {
        const acesso = await acessoDoUsuario(prisma, usuarioDa(request))
        const periodo = intervaloDosDias(q.de, q.ate)
        const faixa = { gte: periodo.inicio, lt: periodo.fim }
        const [caixas, formas, vendedores] = await Promise.all([
            prisma.cashierSession.findMany({
                where: {
                    AND: [
                        { OR: [{ opened_at: faixa }, { sales: { some: { created_at: faixa } } }] },
                        ...(acesso.soDoOperador ? [{ user_id: acesso.soDoOperador }] : []),
                    ],
                },
                select: { id: true, period: true, sequence_number: true, terminal_id: true, opened_at: true, status: true },
                orderBy: { opened_at: 'desc' },
                take: 300,
            }),
            prisma.cashierEntry.findMany({
                where: ondeOsLancamentos({ periodo: { inicio: periodo.inicio, fim: periodo.fim }, soDoOperador: acesso.soDoOperador }),
                distinct: ['payment_method'],
                select: { payment_method: true },
            }),
            prisma.saleItem.findMany({
                where: { sale: { created_at: faixa }, OR: [{ seller_employee_id: { not: null } }, { seller_name: { not: null } }] },
                distinct: ['seller_employee_id', 'seller_name'],
                select: { seller_employee_id: true, seller_name: true, seller_number: true, seller: { select: { name: true } } },
            }),
        ])
        const porChave = new Map<string, { chave: string; nome: string; numero: number | null }>()
        for (const v of vendedores) {
            const chave = chaveDoVendedor(v)
            if (chave === 'sem' || porChave.has(chave)) continue
            porChave.set(chave, { chave, nome: nomeDoVendedor(v) ?? 'Vendedor', numero: v.seller_number ?? null })
        }
        return {
            periodo: { de: periodo.de, ate: periodo.ate },
            caixas: caixas.map(c => rotuloDoCaixa(c)),
            formas: [...new Set(formas.map(f => (f.payment_method ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
            vendedores: [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
            origens: ORIGENS,
        }
    })
}
