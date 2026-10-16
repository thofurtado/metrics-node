import type { Prisma } from '@prisma/client'
import { diaOperacional, inicioDoDiaOperacional } from '@/lib/dia-operacional'
import { codigoDePlataforma, normalizarNome } from '@/modules/cashier/services/plataformas'

/**
 * Filtros do módulo Vendas (Vendas, etapa 3; decisões D1, D2 e D10 do Thomás, 16/10/2026; ESPEC-VENDAS-E-ESTOQUE.md):
 * período (dias operacionais, que viram às 05:00 de Brasília, como o caixa), caixa, origem, forma, vendedor, produto e busca.
 * A origem da venda é uma regra só (origemDaVenda), usada na lista, no detalhe e no filtro (ondeAOrigem).
 */

const DIA_MS = 24 * 60 * 60 * 1000
/** Período máximo das consultas (os relatórios somam item a item): um ano. */
export const DIAS_NO_MAXIMO = 366

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/

export class FiltroInvalido extends Error {}

/**
 * O intervalo [início, fim) dos dias operacionais de "de" até "ate" (AAAA-MM-DD, os dois inclusos). Sem os dois: hoje.
 * Um só: aquele dia. Venda das 02:00 do dia 17 é do dia 16 (o dia vira às 05:00), como no caixa e no PDV.
 */
export function intervaloDosDias(de?: string | null, ate?: string | null, agora: Date = new Date()): { de: string; ate: string; inicio: Date; fim: Date } {
    const hoje = diaOperacional(agora)
    const inicioDia = (de || ate || hoje).trim()
    const fimDia = (ate || de || hoje).trim()
    if (!DIA_VALIDO.test(inicioDia) || !DIA_VALIDO.test(fimDia)) throw new FiltroInvalido('Use as datas no formato AAAA-MM-DD.')
    const inicio = inicioDoDiaOperacional(inicioDia)
    const fim = new Date(inicioDoDiaOperacional(fimDia).getTime() + DIA_MS)
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) throw new FiltroInvalido('Data inválida.')
    if (fim <= inicio) throw new FiltroInvalido('A data final é antes da inicial.')
    if ((fim.getTime() - inicio.getTime()) / DIA_MS > DIAS_NO_MAXIMO) throw new FiltroInvalido('Escolha um período de até 1 ano.')
    return { de: inicioDia, ate: fimDia, inicio, fim }
}

// ---------------------------------------------------------------------------------------------------------------
// Origem da venda
// ---------------------------------------------------------------------------------------------------------------

export type TipoDeOrigem = 'BALCAO' | 'MESA' | 'COMANDA' | 'DELIVERY' | 'IFOOD' | '99FOOD' | 'OUTRA'

export const ORIGENS: { tipo: TipoDeOrigem; nome: string }[] = [
    { tipo: 'BALCAO', nome: 'Balcão' },
    { tipo: 'MESA', nome: 'Mesa' },
    { tipo: 'COMANDA', nome: 'Comanda' },
    { tipo: 'DELIVERY', nome: 'Delivery' },
    { tipo: 'IFOOD', nome: 'iFood' },
    { tipo: '99FOOD', nome: '99Food' },
]

const comPrefixo = (prefixo: string, identificador: string) => {
    const id = identificador.trim()
    return normalizarNome(id).startsWith(normalizarNome(prefixo)) ? id : `${prefixo} ${id}`
}

/**
 * De onde a venda veio, pelo que o PDV manda: a origem ("Balcao", "Salao", "Mesa", "Mesa 21 Conta B", "Delivery", "iFood",
 * "99Food"), a mesa/comanda (origin_identifier) e a plataforma dos pagamentos (platform_code, iFood/99 pago em dinheiro).
 * No PDV a comanda é cobrada como "Balcao" com o número da comanda; balcão sem número é a venda do caixa.
 */
export function origemDaVenda(origem: string | null | undefined, identificador?: string | null, plataforma?: string | null): { tipo: TipoDeOrigem; rotulo: string } {
    const o = normalizarNome(origem)
    const id = (identificador ?? '').trim()
    const p = codigoDePlataforma(plataforma)
    const original = (origem ?? '').trim()
    if (p === 'IFOOD' || o.includes('ifood')) return { tipo: 'IFOOD', rotulo: 'iFood' }
    if (p === '99FOOD' || /99 ?food/.test(o)) return { tipo: '99FOOD', rotulo: '99Food' }
    if (o.includes('delivery') || o.includes('entrega')) return { tipo: 'DELIVERY', rotulo: 'Delivery' }
    if (o.includes('comanda')) return { tipo: 'COMANDA', rotulo: original.length > 'comanda'.length ? original : id ? comPrefixo('Comanda', id) : 'Comanda' }
    if (o.includes('mesa') || o.includes('salao')) {
        if (o.startsWith('mesa') && original.length > 'mesa'.length) return { tipo: 'MESA', rotulo: original }
        return { tipo: 'MESA', rotulo: id ? comPrefixo('Mesa', id) : 'Mesa' }
    }
    if (o.includes('balc')) return id ? { tipo: 'COMANDA', rotulo: comPrefixo('Comanda', id) } : { tipo: 'BALCAO', rotulo: 'Balcão' }
    if (o === '' || o === 'pdv') return { tipo: 'BALCAO', rotulo: 'Balcão' }
    return { tipo: 'OUTRA', rotulo: original }
}

const contem = (texto: string): Prisma.StringNullableFilter => ({ contains: texto, mode: 'insensitive' })

/** O filtro do banco para uma origem (a mesma regra de origemDaVenda). */
export function ondeAOrigem(tipo: string): Prisma.SaleWhereInput | null {
    const ifood: Prisma.SaleWhereInput = { OR: [{ origin: contem('ifood') }, { entries: { some: { platform_code: 'IFOOD' } } }] }
    const noventaENove: Prisma.SaleWhereInput = { OR: [{ origin: contem('99food') }, { origin: contem('99 food') }, { entries: { some: { platform_code: '99FOOD' } } }] }
    const deApp: Prisma.SaleWhereInput = { OR: [...ifood.OR as Prisma.SaleWhereInput[], ...noventaENove.OR as Prisma.SaleWhereInput[]] }
    const delivery: Prisma.SaleWhereInput = { OR: [{ origin: contem('delivery') }, { origin: contem('entrega') }] }
    const comanda: Prisma.SaleWhereInput = { OR: [{ origin: contem('comanda') }, { AND: [{ origin: contem('balc') }, { origin_identifier: { not: null } }, { NOT: { origin_identifier: '' } }] }] }
    const mesa: Prisma.SaleWhereInput = { OR: [{ origin: contem('mesa') }, { origin: contem('salao') }, { origin: contem('salão') }] }
    switch ((tipo || '').toUpperCase()) {
        case 'IFOOD': return ifood
        case '99FOOD': return { AND: [noventaENove, { NOT: ifood }] }
        case 'DELIVERY': return { AND: [delivery, { NOT: deApp }] }
        case 'COMANDA': return { AND: [comanda, { NOT: deApp }, { NOT: delivery }] }
        case 'MESA': return { AND: [mesa, { NOT: deApp }, { NOT: delivery }, { NOT: { origin: contem('comanda') } }] }
        case 'BALCAO': return {
            AND: [
                { OR: [{ origin: null }, { origin: '' }, { origin: { equals: 'PDV', mode: 'insensitive' } }, { AND: [{ origin: contem('balc') }, { OR: [{ origin_identifier: null }, { origin_identifier: '' }] }] }] },
                { NOT: deApp },
            ],
        }
        default: return null
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Vendedor
// ---------------------------------------------------------------------------------------------------------------

export interface VendedorDoItem {
    seller_employee_id?: string | null
    seller_name?: string | null
    seller_number?: number | null
    seller?: { name: string } | null
}

/** A chave do vendedor: "f:<funcionário do RH>", "n:<nome que veio do PDV>" ou "sem" (venda antiga ou loja sem vendedor). */
export function chaveDoVendedor(i: VendedorDoItem): string {
    if (i.seller_employee_id) return `f:${i.seller_employee_id}`
    const nome = (i.seller_name ?? '').trim()
    return nome ? `n:${nome}` : 'sem'
}

export function nomeDoVendedor(i: VendedorDoItem): string | null {
    return i.seller?.name?.trim() || (i.seller_name ?? '').trim() || null
}

/** O filtro do banco para o item de um vendedor (chave de chaveDoVendedor). */
export function ondeOVendedor(chave: string): Prisma.SaleItemWhereInput | null {
    const c = (chave || '').trim()
    if (!c) return null
    if (c === 'sem') return { seller_employee_id: null, OR: [{ seller_name: null }, { seller_name: '' }] }
    if (c.startsWith('f:')) return { seller_employee_id: c.slice(2) }
    if (c.startsWith('n:')) return { seller_employee_id: null, seller_name: { equals: c.slice(2), mode: 'insensitive' } }
    return null
}

// ---------------------------------------------------------------------------------------------------------------
// As vendas de um filtro
// ---------------------------------------------------------------------------------------------------------------

export interface FiltroDasVendas {
    /** Intervalo de intervaloDosDias; sem ele (só o caixa), todas as vendas do caixa */
    periodo?: { inicio: Date; fim: Date } | null
    caixaId?: string | null
    origem?: string | null
    forma?: string | null
    vendedor?: string | null
    produto?: string | null
    busca?: string | null
    /** 'todas' (padrão: a cancelada continua na lista, D12), 'concluidas' ou 'canceladas' */
    situacao?: string | null
    /** Operador de caixa (papel CASHIER): só as vendas dos caixas dele, como a lista de caixas da Conferência */
    soDoOperador?: string | null
}

const soNumero = (texto: string) => (/^\d{1,9}$/.test(texto) ? Number(texto) : null)

/** O item que bate com o texto do produto: nome como vendido, nome do cadastro ou o código do produto. */
export function ondeOProduto(texto: string): Prisma.SaleItemWhereInput | null {
    const t = (texto || '').trim()
    if (!t) return null
    const n = soNumero(t)
    const ou: Prisma.SaleItemWhereInput[] = [{ sold_name: contem(t) }, { product: { name: { contains: t, mode: 'insensitive' } } }]
    if (n != null) ou.push({ product: { display_id: n } })
    return { OR: ou }
}

/** O filtro do banco das vendas (lista, conta, relatórios). */
export function ondeAsVendas(f: FiltroDasVendas): Prisma.SaleWhereInput {
    const e: Prisma.SaleWhereInput[] = []
    if (f.periodo) e.push({ created_at: { gte: f.periodo.inicio, lt: f.periodo.fim } })
    if (f.caixaId) e.push({ cashier_session_id: f.caixaId })
    if (f.soDoOperador) e.push({ cashierSession: { user_id: f.soDoOperador } })
    const situacao = (f.situacao || '').toLowerCase()
    if (situacao === 'canceladas') e.push({ status: 'CANCELLED' })
    if (situacao === 'concluidas') e.push({ NOT: { status: 'CANCELLED' } })
    const origem = f.origem ? ondeAOrigem(f.origem) : null
    if (origem) e.push(origem)
    if (f.forma && f.forma.trim()) e.push({ entries: { some: { payment_method: { equals: f.forma.trim(), mode: 'insensitive' }, is_withdrawal: false } } })
    const vendedor = f.vendedor ? ondeOVendedor(f.vendedor) : null
    if (vendedor) e.push({ items: { some: vendedor } })
    const produto = f.produto ? ondeOProduto(f.produto) : null
    if (produto) e.push({ items: { some: produto } })
    const busca = (f.busca || '').trim()
    if (busca) {
        const n = soNumero(busca.replace(/^#/, ''))
        const ou: Prisma.SaleWhereInput[] = [
            { origin_identifier: contem(busca) },
            { origin: contem(busca) },
            { items: { some: { OR: [{ sold_name: contem(busca) }, { product: { name: { contains: busca, mode: 'insensitive' } } }] } } },
            { client: { name: { contains: busca, mode: 'insensitive' } } },
        ]
        if (n != null) ou.push({ display_id: n }, { daily_number: n }, { nfce_number: n })
        // O código curto da venda ("#1f9408ee", o mesmo do lançamento "Pedido #1f9408ee")
        const prefixo = busca.replace(/^#/, '').toLowerCase()
        if (/^[0-9a-f-]{4,36}$/.test(prefixo)) ou.push({ id: { startsWith: prefixo } })
        if (/^\d{44}$/.test(busca)) ou.push({ nfce_key: busca })
        e.push({ OR: ou })
    }
    return e.length === 0 ? {} : { AND: e }
}
