import type { Prisma } from '@prisma/client'
import { canUseModule } from '@/http/middlewares/verify-module-access'
import { type ContaDasVendas, type ContextoDasFormas, contaDasVendas, montarContextoDasFormas } from './conta-das-vendas'
import { type FiltroDasVendas, ondeAsVendas, ondeOProduto, ondeOVendedor } from './filtros-das-vendas'

/**
 * Quem lê o banco para o módulo Vendas (etapas 2 e 3, 16/10/2026). As contas e as linhas são montadas pelas funções puras de
 * conta-das-vendas.ts e relatorios-das-vendas.ts; aqui só se escolhe o que buscar (e o mínimo de colunas: um mês da Katatau
 * são ~10 mil vendas e ~22 mil itens).
 */

// O cliente do banco (o prisma da loja ou o de mentira dos testes)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BancoDasVendas = any

/** As formas e os identificadores da web, para separar o recebido do "a prazo" e do "aplicativo a receber". */
export async function contextoDasFormas(db: BancoDasVendas): Promise<ContextoDasFormas> {
    const [formas, identificadores] = await Promise.all([
        db.payment.findMany({ select: { name: true, kind: true } }),
        db.paymentIdentifier.findMany({ select: { name: true, is_correntista_debt: true, is_stock_evasion: true, platform: { select: { code: true } } } }),
    ])
    return montarContextoDasFormas(formas ?? [], identificadores ?? [])
}

/** Os lançamentos de entrada do mesmo recorte das vendas: os das vendas do recorte e os da web sem venda (mesmo caixa/período). */
export function ondeOsLancamentos(f: Pick<FiltroDasVendas, 'periodo' | 'caixaId' | 'soDoOperador'>): Prisma.CashierEntryWhereInput {
    const e: Prisma.CashierEntryWhereInput[] = [{ is_withdrawal: false }, { is_addition: false }]
    if (f.caixaId) e.push({ cashier_session_id: f.caixaId })
    if (f.soDoOperador) e.push({ session: { user_id: f.soDoOperador } })
    if (f.periodo) {
        const faixa = { gte: f.periodo.inicio, lt: f.periodo.fim }
        e.push({ OR: [{ sale: { created_at: faixa } }, { sale_id: null, created_at: faixa }] })
    }
    return { AND: e }
}

const COLUNAS_DO_LANCAMENTO = {
    id: true, amount: true, payment_method: true, bank: true, is_withdrawal: true, is_addition: true, is_tip: true, type: true,
    identification: true, sale_id: true, client_id: true, employee_id: true, platform_code: true,
} as const

/** A conta única (D11) de um caixa e/ou de um período. */
export async function carregarConta(db: BancoDasVendas, f: Pick<FiltroDasVendas, 'periodo' | 'caixaId' | 'soDoOperador'>): Promise<ContaDasVendas> {
    const [vendas, lancamentos, ctx] = await Promise.all([
        db.sale.findMany({
            where: ondeAsVendas({ periodo: f.periodo, caixaId: f.caixaId, soDoOperador: f.soDoOperador }),
            select: { id: true, status: true, total_amount: true, discount: true, delivery_fee: true, service_fee: true, cover_charge: true },
        }),
        db.cashierEntry.findMany({ where: ondeOsLancamentos(f), select: COLUNAS_DO_LANCAMENTO }),
        contextoDasFormas(db),
    ])
    return contaDasVendas(vendas ?? [], lancamentos ?? [], ctx)
}

/**
 * Pode ver custo e margem? Segue a regra de acesso de hoje (D9: as permissões por grupo ficam para depois): o custo aparece
 * na web em Mercadorias e no Controle de Estoque, então vê quem pode usar um deles (ou o Financeiro). ADMIN vê; o operador de
 * caixa (CASHIER), que hoje só entra na Conferência de caixa, não vê.
 */
export async function acessoDoUsuario(db: BancoDasVendas, userId: string | null | undefined): Promise<{ veCusto: boolean; soDoOperador: string | null }> {
    if (!userId) return { veCusto: false, soDoOperador: null }
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, userModules: { select: { module: { select: { slug: true } } } } },
    })
    if (!user) return { veCusto: false, soDoOperador: null }
    const slugs = (user.userModules ?? []).map((um: { module: { slug: string } }) => um.module.slug)
    return {
        veCusto: canUseModule(user.role, slugs, ['items', 'stock', 'finance']),
        // A lista de caixas da Conferência já mostra ao operador só os caixas dele (getSessions): o mesmo aqui
        soDoOperador: user.role === 'CASHIER' ? userId : null,
    }
}

/** Os itens vendidos (vendas não canceladas) para os relatórios de produtos e de vendedores. */
export async function carregarItensVendidos(db: BancoDasVendas, f: FiltroDasVendas) {
    const ondeItem: Prisma.SaleItemWhereInput[] = [{ sale: { AND: [ondeAsVendas({ ...f, vendedor: null, produto: null, situacao: 'concluidas' })] } }]
    const vendedor = f.vendedor ? ondeOVendedor(f.vendedor) : null
    if (vendedor) ondeItem.push(vendedor)
    const produto = f.produto ? ondeOProduto(f.produto) : null
    if (produto) ondeItem.push(produto)
    return db.saleItem.findMany({
        where: { AND: ondeItem },
        select: {
            sale_id: true, product_id: true, sold_name: true, quantity: true, unit_price: true, discount: true,
            unit_cost: true, complements_cost: true, seller_employee_id: true, seller_name: true, seller_number: true,
            product: { select: { id: true, name: true, display_id: true, measureUnit: true } },
            seller: { select: { name: true } },
        },
    })
}
