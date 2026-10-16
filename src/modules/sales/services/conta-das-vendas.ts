import { isEmployeePayment, isTermPayment } from '@/modules/pdv-sync/services/cashier-sync-rules'
import { categoriaDeCartao } from '@/modules/pdv-sync/services/pagamentos-do-pdv'
import {
    type FormasDaPlataforma,
    montarFormasDaPlataforma,
    normalizarNome,
    plataformaDoTextoAntigo,
} from '@/modules/cashier/services/plataformas'

/**
 * A conta única das vendas (Vendas, etapa 2; decisão D11 do Thomás, 16/10/2026: "uma conta só na nuvem, usada pelo Dashboard,
 * pela Conferência de caixa e pelo módulo Vendas"; _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md).
 *
 * - "Total vendido" = as vendas NÃO canceladas (itens + taxas − descontos; o total que o PDV fechou) mais o que foi lançado
 *   no caixa da web sem venda registrada (loja sem PDV: o lançamento É a venda).
 * - "Total recebido" = os pagamentos das formas que se CONTAM (dinheiro, Pix, cartões, vale), por forma, com o banco ou a
 *   maquininha e o "Sem maquininha".
 * - A linha que explica a diferença: a prazo (fiado, consumo de funcionário, permuta, cortesia) e aplicativo a receber
 *   (pago no app do iFood/99) foram vendidos mas não recebidos; a caixinha foi recebida mas não é venda; as canceladas ficam
 *   fora dos dois lados (D12).
 *
 * É a mesma separação do fechamento do PDV (Metrics.Shared/Services/ConferenciaDoFechamento.cs e FechamentoCaixaView): as
 * formas "Sem contagem física" (a prazo, aplicativos, pago na plataforma) ficam fora da comparação e aparecem à parte.
 * Tudo aqui é função pura (testes em conta-das-vendas.spec.ts); quem lê o banco é services/consultas-das-vendas.ts.
 */

export type TipoDaForma = 'DINHEIRO' | 'CONTADA' | 'PRAZO' | 'PLATAFORMA'

export const SEM_MAQUININHA = 'Sem maquininha'

export const centavos = (valor: number) => Math.round(((Number(valor) || 0) + Number.EPSILON) * 100) / 100

/** "R$ 8.788,52" (sem sinal: a linha da diferença diz o sinal em palavras). */
export function moeda(valor: number): string {
    const [inteiro, decimais] = centavos(Math.abs(valor)).toFixed(2).split('.')
    return `R$ ${inteiro.replace(/\B(?=(\d{3})+$)/g, '.')},${decimais}`
}

// ---------------------------------------------------------------------------------------------------------------
// Item vendido: valor e custo
// ---------------------------------------------------------------------------------------------------------------

export interface ItemParaConta {
    quantity: number
    unit_price: number
    discount?: number | null
}

/** Valor do item na venda: quantidade × preço − desconto do item (o desconto da venda fica na venda). */
export function valorDoItem(item: ItemParaConta): number {
    return centavos((Number(item.quantity) || 0) * (Number(item.unit_price) || 0) - (Number(item.discount) || 0))
}

export interface CustoDoItemEntrada {
    quantity: number
    unit_cost?: number | null
    complements_cost?: number | null
}

/**
 * Custo do item congelado na venda: (custo da unidade + custo dos complementos da unidade) × quantidade
 * (convenção de modules/pdv-sync/services/item-cost.ts). Venda antiga sem custo congelado = null ("—" na web).
 */
export function custoDoItem(item: CustoDoItemEntrada): number | null {
    if (item.unit_cost == null && item.complements_cost == null) return null
    const porUnidade = (Number(item.unit_cost) || 0) + (Number(item.complements_cost) || 0)
    return Math.round(porUnidade * (Number(item.quantity) || 0) * 10000) / 10000
}

/** Margem em reais e em % do valor (null quando não há custo ou o valor é zero). */
export function margem(valor: number, custo: number | null): { valor: number | null; percentual: number | null } {
    if (custo == null) return { valor: null, percentual: null }
    const m = centavos(valor - custo)
    return { valor: m, percentual: valor > 0 ? Math.round((m / valor) * 10000) / 100 : null }
}

// ---------------------------------------------------------------------------------------------------------------
// Caixinha (mesma regra da web: metrics/src/utils/cashier/caixinha.ts, decisão de 29/09/2026)
// ---------------------------------------------------------------------------------------------------------------

const REGEX_CAIXINHA = /\[(?:Gorjeta|Caixinha):\s*R\$\s*([\d.,]+)(?:\s*\|\s*([^\]]+))?\]/i

/** "1.250,00", "1250.00" e "18,00" viram número (formato brasileiro e o internacional). */
export function lerMoeda(texto: string): number {
    const t = (texto || '').trim()
    if (!t) return 0
    if (t.includes('.') && t.includes(',')) {
        return t.lastIndexOf(',') > t.lastIndexOf('.')
            ? parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0
            : parseFloat(t.replace(/,/g, '')) || 0
    }
    if (t.includes(',')) return parseFloat(t.replace(',', '.')) || 0
    if ((t.match(/\./g) || []).length > 1) return parseFloat(t.replace(/\./g, '')) || 0
    return parseFloat(t) || 0
}

export interface LancamentoParaConta {
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
}

/** É a caixinha avulsa (o lançamento inteiro é gorjeta, sem venda)? */
export function ehCaixinhaAvulsa(l: LancamentoParaConta): boolean {
    const metodo = normalizarNome(l.payment_method)
    return Boolean(l.is_tip) || l.type === 'TIP' || metodo === 'caixinha' || metodo === 'gorjeta'
}

/**
 * Quanto do lançamento é caixinha: SÓ o excedente marcado ("[Caixinha: R$ 18,00]" numa conta de R$ 182 paga com R$ 200) ou o
 * lançamento inteiro quando é caixinha avulsa. Serviço 10% nunca é caixinha (é da conta e vai na nota).
 */
export function caixinhaDoLancamento(l: LancamentoParaConta): number {
    const marcada = String(l.identification ?? '').match(REGEX_CAIXINHA)
    const valorMarcado = marcada ? lerMoeda(marcada[1]) : 0
    if (valorMarcado > 0) return centavos(Math.min(valorMarcado, Number(l.amount) || 0))
    if (ehCaixinhaAvulsa(l)) return centavos(Number(l.amount) || 0)
    return 0
}

// ---------------------------------------------------------------------------------------------------------------
// Tipo da forma: contada (entra no "Total recebido") ou sem contagem física (a prazo, aplicativo)
// ---------------------------------------------------------------------------------------------------------------

export interface ContextoDasFormas {
    /** Formas do tipo PLATAFORMA e identificadores ligados a uma plataforma (iFood, 99Food), pelo nome normalizado. */
    plataforma: FormasDaPlataforma
    /** Identificadores a prazo/da casa cadastrados na web (is_correntista_debt ou is_stock_evasion), pelo nome normalizado. */
    prazo: Set<string>
}

export const CONTEXTO_VAZIO: ContextoDasFormas = {
    plataforma: { identificadores: new Map(), formas: new Set() },
    prazo: new Set(),
}

/** O contexto a partir dos cadastros da web (formas e identificadores). */
export function montarContextoDasFormas(
    formas: { name: string; kind: string | null }[],
    identificadores: { name: string; is_correntista_debt?: boolean | null; is_stock_evasion?: boolean | null; platform?: { code: string } | null }[],
): ContextoDasFormas {
    const prazo = new Set<string>()
    for (const i of identificadores) {
        if (i.is_correntista_debt || i.is_stock_evasion) prazo.add(normalizarNome(i.name))
    }
    return {
        plataforma: montarFormasDaPlataforma(formas, identificadores.map(i => ({ name: i.name, platform: i.platform ?? null }))),
        prazo,
    }
}

// As mesmas palavras do fechamento do PDV ("Sem contagem física": Fiado, A Prazo, Online, iFood, App) e as formas da casa.
const PALAVRAS_DA_PLATAFORMA = /\b(ifood|99 ?food|online|app|plataforma)\b/
const PALAVRAS_DO_PRAZO = /(prazo|fiado|correntista|permuta|funcionari|colaborador|cortesia|pro.?labore|convenio|consumo|conta da casa)/

/**
 * O tipo do pagamento, na ordem: pago na plataforma (o dinheiro vem no repasse) → a prazo e consumo (ninguém pagou ainda, ou
 * é da casa) → dinheiro → as outras formas que se contam (Pix, cartões, vale). O pagamento em dinheiro de um pedido do iFood é
 * DINHEIRO (o motoboy trouxe o dinheiro), como no PDV.
 */
export function tipoDaForma(l: LancamentoParaConta, ctx: ContextoDasFormas = CONTEXTO_VAZIO): TipoDaForma {
    const metodo = normalizarNome(l.payment_method)
    if (ctx.plataforma.identificadores.has(metodo) || ctx.plataforma.formas.has(metodo) || plataformaDoTextoAntigo(l.payment_method)
        || PALAVRAS_DA_PLATAFORMA.test(metodo)) return 'PLATAFORMA'
    if (ctx.prazo.has(metodo) || isTermPayment(l.payment_method) || isEmployeePayment(l.payment_method)
        || PALAVRAS_DO_PRAZO.test(metodo) || normalizarNome(l.bank) === 'conta da casa'
        || Boolean(l.client_id) || Boolean(l.employee_id)) return 'PRAZO'
    if (metodo === '' || metodo.startsWith('dinheiro') || metodo === 'especie') return 'DINHEIRO'
    return 'CONTADA'
}

/** O nome da forma nos totais: Dinheiro, PIX, Débito, Crédito, Voucher ou o nome que veio (ex.: "Correntista", "iFood"). */
export function nomeDaForma(l: LancamentoParaConta, tipo: TipoDaForma = tipoDaForma(l)): string {
    if (tipo === 'DINHEIRO') return 'Dinheiro'
    if (tipo === 'CONTADA') {
        const c = categoriaDeCartao(l.payment_method)
        if (c === 'PIX') return 'PIX'
        if (c === 'DEBITO') return 'Débito'
        if (c === 'CREDITO') return 'Crédito'
        if (c === 'VOUCHER') return 'Voucher'
    }
    const nome = (l.payment_method ?? '').trim()
    return nome || 'Outros'
}

/** A maquininha (ou o banco) do pagamento; sem banco (o Pix "sem maquininha" do PDV) ou "CAIXA" = "Sem maquininha". */
export function maquininhaDoLancamento(l: LancamentoParaConta): string {
    const banco = (l.bank ?? '').trim()
    return banco === '' || banco.toUpperCase() === 'CAIXA' ? SEM_MAQUININHA : banco
}

// ---------------------------------------------------------------------------------------------------------------
// A conta
// ---------------------------------------------------------------------------------------------------------------

export interface VendaParaConta {
    id: string
    status: string
    total_amount: number
    discount?: number | null
    delivery_fee?: number | null
    service_fee?: number | null
    cover_charge?: number | null
}

export const vendaCancelada = (v: { status: string | null | undefined }) => (v.status ?? '').toUpperCase() === 'CANCELLED'

export interface FormaRecebida {
    forma: string
    total: number
    quantidade: number
    maquininhas: { nome: string; total: number }[]
}

export interface FormaSemContagem {
    tipo: 'PRAZO' | 'PLATAFORMA'
    forma: string
    total: number
    quantidade: number
}

export interface ContaDasVendas {
    vendido: {
        total: number
        /** Vendas do PDV (e da web com itens) não canceladas */
        vendas: number
        quantidade: number
        /** Os itens das vendas: total − taxas + descontos (o PDV fecha a venda assim: itens − desconto + entrega + serviço + couvert) */
        itens: number
        taxas: { entrega: number; servico: number; couvert: number; total: number }
        descontos: number
        /** Lançado no caixa da web sem venda registrada (loja sem PDV) */
        lancadoSemVenda: number
        lancamentosSemVenda: number
        ticketMedio: number
    }
    recebido: {
        total: number
        dinheiro: number
        /** Pix, cartões e vale (o que não é dinheiro) */
        eletronico: number
        porForma: FormaRecebida[]
    }
    semContagem: {
        total: number
        aPrazo: number
        aplicativo: number
        porForma: FormaSemContagem[]
    }
    caixinha: number
    cancelados: { quantidade: number; total: number }
    diferenca: {
        /** vendido − recebido */
        valor: number
        aPrazo: number
        aplicativo: number
        caixinha: number
        /** O que sobra depois de explicar: venda sem pagamento registrado (+) ou pagamento sem venda (−) */
        semExplicacao: number
        /** A linha em palavras ("Vendido R$ … − a prazo R$ … = Recebido R$ …") */
        linha: string
        /** "3 vendas canceladas (R$ 120,00) ficam fora dos dois totais." (vazio sem cancelada) */
        canceladas: string
    }
}

const ORDEM_DAS_FORMAS = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Voucher']
const ordemDaForma = (f: string) => {
    const i = ORDEM_DAS_FORMAS.indexOf(f)
    return i === -1 ? ORDEM_DAS_FORMAS.length : i
}

/**
 * A conta de um conjunto de vendas e dos lançamentos de entrada do mesmo recorte (um caixa, ou um período).
 * As saídas e os suprimentos (is_withdrawal / is_addition) são da gaveta, não de venda: são ignorados aqui.
 */
export function contaDasVendas(
    vendas: VendaParaConta[],
    lancamentos: LancamentoParaConta[],
    ctx: ContextoDasFormas = CONTEXTO_VAZIO,
): ContaDasVendas {
    let vendasTotal = 0, quantidade = 0, entrega = 0, servico = 0, couvert = 0, descontos = 0
    let canceladasQtd = 0, canceladasTotal = 0
    for (const v of vendas) {
        if (vendaCancelada(v)) {
            canceladasQtd++
            canceladasTotal += Number(v.total_amount) || 0
            continue
        }
        quantidade++
        vendasTotal += Number(v.total_amount) || 0
        entrega += Number(v.delivery_fee) || 0
        servico += Number(v.service_fee) || 0
        couvert += Number(v.cover_charge) || 0
        descontos += Number(v.discount) || 0
    }

    let lancadoSemVenda = 0, lancamentosSemVenda = 0, caixinha = 0
    const recebidas = new Map<string, { total: number; quantidade: number; maquininhas: Map<string, number> }>()
    const semContagem = new Map<string, FormaSemContagem>()
    let recebidoTotal = 0, dinheiro = 0, aPrazo = 0, aplicativo = 0

    for (const l of lancamentos) {
        if (l.is_withdrawal || l.is_addition) continue
        const valor = Number(l.amount) || 0
        if (valor === 0) continue
        const gorjeta = caixinhaDoLancamento(l)
        caixinha += gorjeta
        // Lançamento da web sem venda (loja sem PDV, ou lançado à mão): a parte que não é caixinha é venda. O lançamento com
        // venda é sempre de uma venda do mesmo recorte (quem carrega escolhe assim: services/consultas-das-vendas.ts).
        if (!l.sale_id && !ehCaixinhaAvulsa(l)) {
            lancadoSemVenda += valor - gorjeta
            lancamentosSemVenda++
        }

        const tipo = tipoDaForma(l, ctx)
        const forma = nomeDaForma(l, tipo)
        if (tipo === 'PRAZO' || tipo === 'PLATAFORMA') {
            const chave = `${tipo}|${forma}`
            const atual = semContagem.get(chave) ?? { tipo, forma, total: 0, quantidade: 0 }
            atual.total += valor
            atual.quantidade++
            semContagem.set(chave, atual)
            if (tipo === 'PRAZO') aPrazo += valor
            else aplicativo += valor
            continue
        }
        recebidoTotal += valor
        if (tipo === 'DINHEIRO') dinheiro += valor
        const atual = recebidas.get(forma) ?? { total: 0, quantidade: 0, maquininhas: new Map<string, number>() }
        atual.total += valor
        atual.quantidade++
        if (tipo !== 'DINHEIRO') {
            const maq = maquininhaDoLancamento(l)
            atual.maquininhas.set(maq, (atual.maquininhas.get(maq) ?? 0) + valor)
        }
        recebidas.set(forma, atual)
    }

    const porForma: FormaRecebida[] = [...recebidas.entries()]
        .map(([forma, r]) => ({
            forma,
            total: centavos(r.total),
            quantidade: r.quantidade,
            // "Sem maquininha" por último, como no quadro da Conferência
            maquininhas: [...r.maquininhas.entries()]
                .map(([nome, total]) => ({ nome, total: centavos(total) }))
                .sort((a, b) => Number(a.nome === SEM_MAQUININHA) - Number(b.nome === SEM_MAQUININHA) || b.total - a.total),
        }))
        .sort((a, b) => ordemDaForma(a.forma) - ordemDaForma(b.forma) || b.total - a.total)

    const taxasTotal = centavos(entrega + servico + couvert)
    const vendidoVendas = centavos(vendasTotal)
    const itens = centavos(vendidoVendas - taxasTotal + centavos(descontos))
    const vendidoTotal = centavos(vendasTotal + lancadoSemVenda)
    const recebido = centavos(recebidoTotal)
    const valorDiferenca = centavos(vendidoTotal - recebido)
    // vendido + caixinha = recebido + a prazo + aplicativo + o que sobra
    const semExplicacao = centavos(vendidoTotal + caixinha - recebido - aPrazo - aplicativo)

    const conta: ContaDasVendas = {
        vendido: {
            total: vendidoTotal,
            vendas: vendidoVendas,
            quantidade,
            itens,
            taxas: { entrega: centavos(entrega), servico: centavos(servico), couvert: centavos(couvert), total: taxasTotal },
            descontos: centavos(descontos),
            lancadoSemVenda: centavos(lancadoSemVenda),
            lancamentosSemVenda,
            ticketMedio: quantidade > 0 ? centavos(vendidoVendas / quantidade) : 0,
        },
        recebido: { total: recebido, dinheiro: centavos(dinheiro), eletronico: centavos(recebidoTotal - dinheiro), porForma },
        semContagem: {
            total: centavos(aPrazo + aplicativo),
            aPrazo: centavos(aPrazo),
            aplicativo: centavos(aplicativo),
            porForma: [...semContagem.values()]
                .map(s => ({ ...s, total: centavos(s.total) }))
                .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.total - a.total),
        },
        caixinha: centavos(caixinha),
        cancelados: { quantidade: canceladasQtd, total: centavos(canceladasTotal) },
        diferenca: {
            valor: valorDiferenca,
            aPrazo: centavos(aPrazo),
            aplicativo: centavos(aplicativo),
            caixinha: centavos(caixinha),
            semExplicacao,
            linha: '',
            canceladas: '',
        },
    }
    conta.diferenca.linha = linhaDaDiferenca(conta)
    conta.diferenca.canceladas = canceladasQtd === 0
        ? ''
        : `${canceladasQtd === 1 ? '1 venda cancelada' : `${canceladasQtd} vendas canceladas`} (${moeda(canceladasTotal)}) ${canceladasQtd === 1 ? 'fica' : 'ficam'} fora dos dois totais.`
    return conta
}

/**
 * A linha em palavras: "Vendido R$ 8.788,52 − a prazo R$ 542,23 − aplicativos a receber R$ 256,71 + caixinha R$ 18,00 =
 * Recebido R$ 8.007,58". Só entra o que não é zero; sem diferença: "Vendido e recebido batem: R$ …".
 */
export function linhaDaDiferenca(c: Pick<ContaDasVendas, 'vendido' | 'recebido' | 'diferenca'>): string {
    const partes: string[] = [`Vendido ${moeda(c.vendido.total)}`]
    if (c.diferenca.aPrazo !== 0) partes.push(`− a prazo ${moeda(c.diferenca.aPrazo)}`)
    if (c.diferenca.aplicativo !== 0) partes.push(`− aplicativos a receber ${moeda(c.diferenca.aplicativo)}`)
    if (c.diferenca.caixinha !== 0) partes.push(`+ caixinha ${moeda(c.diferenca.caixinha)}`)
    if (c.diferenca.semExplicacao > 0) partes.push(`− venda sem pagamento registrado ${moeda(c.diferenca.semExplicacao)}`)
    if (c.diferenca.semExplicacao < 0) partes.push(`+ pagamento sem venda ${moeda(c.diferenca.semExplicacao)}`)
    if (partes.length === 1) return `Vendido e recebido batem: ${moeda(c.vendido.total)}`
    return `${partes.join(' ')} = Recebido ${moeda(c.recebido.total)}`
}
