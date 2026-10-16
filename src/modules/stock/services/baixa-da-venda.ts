import { Prisma } from '@prisma/client'
import { AlvoDoEstoque, Usuario, registrarMovimento } from './movimento-de-estoque'

/**
 * O que cada item vendido baixa do estoque (decisão D8 do Thomás, 16/10/2026; ESPEC-VENDAS-E-ESTOQUE.md):
 *  1. produto COM ficha técnica baixa os insumos da ficha (quantidade da ficha × quantidade vendida);
 *  2. complemento com insumo ligado baixa aquele insumo na quantidade cadastrada na opção (× a quantidade escolhida × a
 *     quantidade vendida);
 *  3. produto SEM ficha baixa ele mesmo.
 * Pizza de vários sabores: cada sabor segue a mesma regra na fração dele. A quantidade VENDIDA de um produto vem dos itens da
 * venda (sale_items), não do estoque: um produto que baixa insumos continua com as vendas contadas.
 *
 * "Tem ficha" = o produto está marcado como composto E tem linhas na ficha (a mesma regra do custo, item-cost.ts, e da tela de
 * Mercadorias, que marca composto quando a ficha tem insumo). Antes o sabor da pizza baixava insumos com qualquer linha de
 * ficha e o produto inteiro só com a marca: o mesmo produto baixava diferente inteiro e em meia.
 *
 * Unidade dos insumos: a que o insumo já tem (kg, un, l...). A quantidade da ficha e a da opção são lidas nessa unidade.
 * Como medir os insumos (quilo, unidade, porção) ainda está para decidir com o Thomás (ver o relatório da etapa 4).
 *
 * O saldo é da nuvem e nunca trava a venda (D5): pode ficar negativo.
 */

export interface InsumoDaBaixa { id: string; cost: number | null }

export interface ProdutoDaBaixa {
    id: string
    cost: number | null
    is_composite: boolean
    compositions: { supply_id: string; quantity: number; supply: { cost: number | null } | null }[]
}

export interface OpcaoDaBaixa {
    id: string
    linked_supply_id: string | null
    supply_quantity: number | null
    supply?: InsumoDaBaixa | null
}

export interface ItemDaBaixa {
    quantidade: number
    produto: ProdutoDaBaixa | null
    /** Custo congelado de UMA unidade do item na venda (usado na baixa do próprio produto inteiro). */
    custoUnitarioDoItem?: number | null
    fracoes: { fracao: number; produto: ProdutoDaBaixa | null }[]
    complementos: {
        quantidade: number
        /** A opção cadastrada na nuvem (manda no insumo e na quantidade). */
        opcao: OpcaoDaBaixa | null
        /** Só quando a opção não existe mais na nuvem: o insumo que o PDV conhecia (quantidade 1). */
        insumoDoPdv?: InsumoDaBaixa | null
    }[]
}

export type OrigemDaLinha = 'FICHA' | 'PRODUTO' | 'COMPLEMENTO'

export interface LinhaDaBaixa {
    alvo: AlvoDoEstoque
    quantidade: number
    custoUnitario: number | null
    origem: OrigemDaLinha
}

const positivo = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
const arredondar = (v: number) => Math.round((v + Number.EPSILON) * 1e6) / 1e6

export function temFichaTecnica(p: Pick<ProdutoDaBaixa, 'is_composite' | 'compositions'> | null | undefined): boolean {
    return !!p && p.is_composite === true && Array.isArray(p.compositions) && p.compositions.length > 0
}

/** As baixas de um item vendido (função pura). */
export function planejarBaixa(item: ItemDaBaixa): LinhaDaBaixa[] {
    const linhas: LinhaDaBaixa[] = []
    const vendida = positivo(item.quantidade)
    if (vendida === 0) return linhas

    const baixarProduto = (p: ProdutoDaBaixa | null, fator: number, inteiro: boolean) => {
        if (!p || fator <= 0) return
        if (temFichaTecnica(p)) {
            for (const linha of p.compositions) {
                linhas.push({
                    alvo: { tipo: 'SUPPLY', id: linha.supply_id },
                    quantidade: arredondar(positivo(linha.quantity) * fator),
                    custoUnitario: linha.supply?.cost ?? null,
                    origem: 'FICHA',
                })
            }
            return
        }
        const custo = inteiro && positivo(item.custoUnitarioDoItem) > 0 ? positivo(item.custoUnitarioDoItem) : (p.cost ?? null)
        linhas.push({ alvo: { tipo: 'PRODUCT', id: p.id }, quantidade: arredondar(fator), custoUnitario: custo, origem: 'PRODUTO' })
    }

    if (item.fracoes.length > 0) {
        for (const f of item.fracoes) baixarProduto(f.produto, positivo(f.fracao) * vendida, false)
    } else {
        baixarProduto(item.produto, vendida, true)
    }

    for (const c of item.complementos) {
        const escolhida = positivo(c.quantidade) || 1
        if (c.opcao) {
            if (!c.opcao.linked_supply_id) continue // opção sem insumo ligado: não baixa nada
            const porUnidade = positivo(c.opcao.supply_quantity) || 1
            linhas.push({
                alvo: { tipo: 'SUPPLY', id: c.opcao.linked_supply_id },
                quantidade: arredondar(porUnidade * escolhida * vendida),
                custoUnitario: c.opcao.supply?.cost ?? null,
                origem: 'COMPLEMENTO',
            })
        } else if (c.insumoDoPdv) {
            linhas.push({
                alvo: { tipo: 'SUPPLY', id: c.insumoDoPdv.id },
                quantidade: arredondar(escolhida * vendida),
                custoUnitario: c.insumoDoPdv.cost ?? null,
                origem: 'COMPLEMENTO',
            })
        }
    }

    return linhas.filter(l => l.quantidade > 0)
}

/** O item como o PDV manda na venda (só o que a baixa usa). */
export interface ItemDoPdvParaBaixa {
    ProductId?: string | null
    Quantity: number
    Fractions?: { ProductId: string; Fraction: number }[] | null
    Complements?: { OptionId?: string | null; LinkedSupplyId?: string | null; Quantity?: number | null }[] | null
}

const comFicha = { compositions: { include: { supply: { select: { cost: true } } } } } as const

/** Lê do banco o que a baixa do item precisa: o produto (ou os sabores) com a ficha e as opções escolhidas. */
export async function carregarItemDaBaixa(tx: Prisma.TransactionClient, item: ItemDoPdvParaBaixa, custoUnitarioDoItem?: number | null): Promise<ItemDaBaixa> {
    const lerProduto = async (id: string | null | undefined): Promise<ProdutoDaBaixa | null> => {
        if (!id) return null
        const p = await tx.product.findUnique({ where: { id }, include: comFicha })
        return p ? { id: p.id, cost: p.cost ?? null, is_composite: p.is_composite, compositions: p.compositions } : null
    }

    const fracoes = []
    for (const f of item.Fractions ?? []) fracoes.push({ fracao: f.Fraction, produto: await lerProduto(f.ProductId) })

    const complementos: ItemDaBaixa['complementos'] = []
    for (const c of item.Complements ?? []) {
        const opcao = c.OptionId ? await tx.complementOption.findUnique({ where: { id: c.OptionId } }) : null
        let insumoDaOpcao: InsumoDaBaixa | null = null
        if (opcao?.linked_supply_id) {
            const s = await tx.supply.findUnique({ where: { id: opcao.linked_supply_id }, select: { id: true, cost: true } })
            if (!s) { complementos.push({ quantidade: c.Quantity ?? 1, opcao: { ...opcao, linked_supply_id: null } }); continue }
            insumoDaOpcao = s
        }
        let insumoDoPdv: InsumoDaBaixa | null = null
        if (!opcao && c.LinkedSupplyId) {
            insumoDoPdv = await tx.supply.findUnique({ where: { id: c.LinkedSupplyId }, select: { id: true, cost: true } })
        }
        complementos.push({
            quantidade: c.Quantity ?? 1,
            opcao: opcao ? { id: opcao.id, linked_supply_id: opcao.linked_supply_id, supply_quantity: opcao.supply_quantity, supply: insumoDaOpcao } : null,
            insumoDoPdv,
        })
    }

    return {
        quantidade: item.Quantity,
        produto: fracoes.length > 0 ? null : await lerProduto(item.ProductId),
        custoUnitarioDoItem: custoUnitarioDoItem ?? null,
        fracoes,
        complementos,
    }
}

/** Grava as baixas do item (cada linha muda o saldo e guarda o saldo logo depois). */
export async function baixarItemVendido(
    tx: Prisma.TransactionClient,
    linhas: LinhaDaBaixa[],
    ctx: { saleItemId: string; criadoEm: Date; usuario?: Usuario | null },
): Promise<void> {
    for (const l of linhas) {
        await registrarMovimento(tx, {
            alvo: l.alvo,
            operacao: 'OUT',
            quantidade: l.quantidade,
            motivo: 'VENDA',
            custoUnitario: l.custoUnitario,
            saleItemId: ctx.saleItemId,
            usuario: ctx.usuario ?? null,
            criadoEm: ctx.criadoEm,
        })
    }
}
