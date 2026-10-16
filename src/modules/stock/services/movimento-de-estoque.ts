import { FastifyRequest } from 'fastify'
import { Prisma, StockReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Movimento de estoque num lugar só (etapa 4 do Vendas e Estoque, decisões D5, D6 e D12 do Thomás, 16/10/2026;
 * _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md).
 *
 * Toda mudança de saldo (venda, estorno, compra pela NF-e, ajuste, inventário, perda vinda do PDV) passa por aqui: muda o saldo
 * do produto ou do insumo e grava a linha em `stocks` com QUEM fez e o SALDO logo depois, na mesma transação. Antes cada tela
 * gravava do seu jeito, sem o usuário e sem o saldo, e o histórico do produto não tinha como dizer "de 10 para 9, por fulano".
 *
 * O saldo é da nuvem e nunca trava nada (D5): a baixa pode deixar o saldo negativo, e o PDV vende do mesmo jeito.
 */

export type TipoDoAlvo = 'PRODUCT' | 'SUPPLY'
export interface AlvoDoEstoque { tipo: TipoDoAlvo; id: string }

export interface Usuario { id?: string | null; nome?: string | null }

export interface NovoMovimento {
    alvo: AlvoDoEstoque
    operacao: 'IN' | 'OUT'
    /** Sempre positiva (a operação diz se entra ou sai). */
    quantidade: number
    motivo: StockReason
    custoUnitario?: number | null
    /** Ajuste e inventário: o saldo exato depois (a quantidade é a diferença). Sem ele, soma ou tira a quantidade. */
    saldoNovo?: number
    /** Compra: o custo do cadastro passa a ser este (só quando maior que zero; nota sem valor não zera o custo). */
    custoNovo?: number | null
    id?: string
    saleItemId?: string | null
    usuario?: Usuario | null
    nota?: string | null
    documento?: { chave?: string | null; numero?: string | null } | null
    cancelamentoId?: string | null
    fornecedorCnpj?: string | null
    lote?: string | null
    validade?: Date | null
    criadoEm?: Date
}

export function textoCurto(t: string | null | undefined, max: number): string | null {
    const limpo = (t ?? '').trim()
    return limpo === '' ? null : limpo.slice(0, max)
}

/** A mudança do saldo no cadastro: o valor exato (ajuste) ou somar/tirar a quantidade. */
export function mudancaDoSaldo(m: Pick<NovoMovimento, 'operacao' | 'quantidade' | 'saldoNovo'>) {
    if (m.saldoNovo !== undefined) return { stock: m.saldoNovo }
    return { stock: m.operacao === 'IN' ? { increment: m.quantidade } : { decrement: m.quantidade } }
}

/** As colunas da linha de estoque do movimento (sem o saldo, que só se sabe depois de mudar o cadastro). */
export function linhaDoMovimento(m: NovoMovimento, saldoDepois: number | null): Prisma.StockUncheckedCreateInput {
    return {
        ...(m.id ? { id: m.id } : {}),
        operation: m.operacao,
        description: m.motivo,
        quantity: m.quantidade,
        unit_cost: m.custoUnitario ?? null,
        product_id: m.alvo.tipo === 'PRODUCT' ? m.alvo.id : null,
        supply_id: m.alvo.tipo === 'SUPPLY' ? m.alvo.id : null,
        sale_item_id: m.saleItemId ?? null,
        user_id: textoCurto(m.usuario?.id, 64),
        user_name: textoCurto(m.usuario?.nome, 120),
        balance_after: saldoDepois,
        note: textoCurto(m.nota, 300),
        document_key: textoCurto(m.documento?.chave, 60),
        document_number: textoCurto(m.documento?.numero, 20),
        cancellation_id: m.cancelamentoId ?? null,
        supplier_cnpj: textoCurto(m.fornecedorCnpj, 20),
        batch_number: textoCurto(m.lote, 60),
        expiration_date: m.validade ?? null,
        ...(m.criadoEm ? { created_at: m.criadoEm } : {}),
    }
}

/**
 * Muda o saldo e grava a linha do movimento com o saldo logo depois. Chamar dentro de uma transação: o cadastro fica travado
 * pelo UPDATE até o fim dela, então o saldo gravado é o desta mudança, mesmo com duas vendas chegando juntas.
 */
export async function registrarMovimento(tx: Prisma.TransactionClient, m: NovoMovimento): Promise<{ id: string | null; saldoDepois: number | null }> {
    const custo = m.custoNovo && m.custoNovo > 0 ? { cost: m.custoNovo } : {}
    const dados = { ...mudancaDoSaldo(m), ...custo }
    const atualizado = m.alvo.tipo === 'PRODUCT'
        ? await tx.product.update({ where: { id: m.alvo.id }, data: dados, select: { stock: true } })
        : await tx.supply.update({ where: { id: m.alvo.id }, data: dados, select: { stock: true } })
    const saldo = (atualizado as { stock?: number | null } | null)?.stock
    const saldoDepois = typeof saldo === 'number' && Number.isFinite(saldo) ? saldo : null
    const linha = await tx.stock.create({ data: linhaDoMovimento(m, saldoDepois) })
    return { id: (linha as { id?: string } | null)?.id ?? null, saldoDepois }
}

/** Quem está usando a web (o usuário do token), para gravar no movimento. Sem usuário (chave de sistema): ninguém. */
export async function usuarioDaRequisicao(request: FastifyRequest): Promise<Usuario | null> {
    const sub = (request.user as { sub?: string } | undefined)?.sub
    if (!sub) return null
    try {
        const u = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, name: true } })
        return u ? { id: u.id, nome: u.name } : { id: sub, nome: null }
    } catch {
        return { id: sub, nome: null }
    }
}
