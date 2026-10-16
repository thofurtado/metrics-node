/**
 * Forma de pagamento "Plataforma" (iFood/99Food) e despesa do caixa paga no Pix, na conferência do caixa (15/10/2026).
 * Decisões do Thomás em _claude-sync/relatorios/PLANO-PLATAFORMAS-E-MOTOBOY.md:
 * - D1: uma forma "Pago na plataforma" (tipo PLATAFORMA) com os identificadores iFood e 99Food, ligados ao cadastro de
 *   plataformas (delivery_platforms);
 * - D2: o valor cheio da venda paga no app é receita (o repasse) e a comissão é despesa, no setor "Taxas de plataforma";
 *   a Liquidação baixa o repasse junto com as comissões da mesma plataforma e data, e o banco recebe o líquido;
 * - D3: as taxas são da loja e corrigíveis na tela; D4: pedido da plataforma pago em dinheiro também lança a comissão;
 * - 2.4: despesa do PDV paga no Pix não sai da gaveta nem do Caixa Central.
 *
 * Antes: "iFood (pago no app)" entrava como um "a receber" qualquer, vencendo no dia e sem comissão nenhuma; o pedido pago em
 * dinheiro não tinha comissão; e toda despesa do PDV saía do dinheiro do Caixa Central, mesmo a paga no Pix.
 *
 * Tudo aqui é função pura: a conferência (cashier-controller.ts) e os testes usam as mesmas regras.
 */

export const KIND_PLATAFORMA = 'PLATAFORMA'
export const SETOR_TAXAS_DE_PLATAFORMA = 'Taxas de plataforma'
export const SETOR_MOTOBOY = 'Motoboy'
/** payment_method das transações do repasse, da comissão e do ajuste da plataforma */
export const METODO_DA_PLATAFORMA = 'PLATAFORMA'

const DIA_MS = 24 * 60 * 60 * 1000
const OFFSET_BRASILIA_MS = -3 * 60 * 60 * 1000

/** Sem acento, sem maiúscula, um espaço só. */
export function normalizarNome(texto: string | null | undefined): string {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Código de plataforma: só letras e números, em maiúsculas ("iFood" → IFOOD, "99Food" → 99FOOD). Vazio = null. */
export function codigoDePlataforma(texto: string | null | undefined): string | null {
    const c = (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    return c || null
}

/** Os dois códigos que o PDV manda hoje, para avisar "cadastre a plataforma" mesmo antes de a loja cadastrar alguma. */
export const NOMES_CONHECIDOS: Record<string, string> = { IFOOD: 'iFood', '99FOOD': '99Food' }

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100

const moeda = (valor: number) => `R$ ${arredondar(valor).toFixed(2).replace('.', ',')}`

// ---------------------------------------------------------------------------------------------------------------
// Data do repasse (plano 2.1)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Quando a plataforma paga as vendas de um dia: o dia operacional do caixa (Brasília) → a semana de segunda a domingo que o
 * contém → a quarta-feira logo depois desse domingo, mais (semanas − 1) × 7 dias. iFood (4 semanas): as vendas de 12 a
 * 18/10/2026 caem em 11/11/2026; 99Food (1 semana): em 21/10/2026. Menos de 1 semana conta como 1.
 */
export function dataDoRepasse(dia: string, semanasDepois: number): string {
    const [a, m, d] = dia.split('-').map(Number)
    const instante = Date.UTC(a, m - 1, d)
    const diaDaSemana = new Date(instante).getUTCDay() // 0 = domingo, 1 = segunda ...
    const domingo = instante + ((7 - diaDaSemana) % 7) * DIA_MS
    const semanas = Math.max(1, Math.floor(Number(semanasDepois) || 1))
    return new Date(domingo + 3 * DIA_MS + (semanas - 1) * 7 * DIA_MS).toISOString().slice(0, 10)
}

/** O vencimento gravado para um dia: meio-dia de Brasília (o mesmo dia em qualquer tela, em qualquer fuso do Brasil). */
export function vencimentoDoDia(dia: string): Date {
    return new Date(`${dia}T15:00:00.000Z`)
}

/** O dia (Brasília) de um vencimento. */
export function diaDeBrasilia(instante: Date): string {
    return new Date(instante.getTime() + OFFSET_BRASILIA_MS).toISOString().slice(0, 10)
}

/** Intervalo [início, fim) do dia de Brasília, para achar as transações de um repasse pelo vencimento. */
export function intervaloDoDiaDeBrasilia(dia: string): { inicio: Date; fim: Date } {
    const inicio = new Date(`${dia}T03:00:00.000Z`)
    return { inicio, fim: new Date(inicio.getTime() + DIA_MS) }
}

// ---------------------------------------------------------------------------------------------------------------
// Qual venda é de plataforma (plano 2.2)
// ---------------------------------------------------------------------------------------------------------------

export interface PlataformaCadastrada {
    id: string
    code: string
    name: string
    account_id: string | null
    commission_own_delivery_pct: number
    commission_platform_delivery_pct: number
    online_payment_fee_pct: number
    payout_weeks_after: number
}

export interface FormasDaPlataforma {
    /** Nome (normalizado) do identificador ligado a uma plataforma → código dela ("ifood" → IFOOD). */
    identificadores: Map<string, string>
    /** Nomes (normalizados) das formas do tipo PLATAFORMA ("pago na plataforma"): a plataforma vem da venda. */
    formas: Set<string>
}

export function montarFormasDaPlataforma(
    formas: { name: string; kind: string | null }[],
    identificadores: { name: string; platform: { code: string } | null }[],
): FormasDaPlataforma {
    const resultado: FormasDaPlataforma = { identificadores: new Map(), formas: new Set() }
    for (const f of formas) {
        if ((f.kind || '').toUpperCase() === KIND_PLATAFORMA) resultado.formas.add(normalizarNome(f.name))
    }
    for (const i of identificadores) {
        const codigo = codigoDePlataforma(i.platform?.code)
        if (codigo) resultado.identificadores.set(normalizarNome(i.name), codigo)
    }
    return resultado
}

/**
 * Forma escondida do PDV para o pedido pago no app (VendaDaPlataforma, desde 12/10/2026): "iFood (pago no app)" e
 * "99Food (pago no app)". Continua valendo para as vendas já feitas e para a loja que ainda não cadastrou a forma nova.
 */
export function plataformaDoTextoAntigo(metodo: string | null | undefined): { codigo: string | null } | null {
    const n = normalizarNome(metodo)
    if (!n.includes('pago no app')) return null
    if (n.includes('ifood')) return { codigo: 'IFOOD' }
    if (n.includes('99')) return { codigo: '99FOOD' }
    return { codigo: null }
}

export interface LancamentoDoCaixa {
    id: string
    amount: number
    payment_method: string | null
    type: string | null
    is_withdrawal: boolean
    is_addition: boolean
    sale_id: string | null
    platform_code?: string | null
    platform_own_delivery?: boolean | null
}

export interface VendaDePlataforma {
    /** Código da plataforma (null = paga no app sem dizer de qual plataforma) */
    codigo: string | null
    /** Paga no app (vira repasse) ou paga na entrega (dinheiro, cartão: só a comissão) */
    pagoNoApp: boolean
    /** Quem entregou: vendas antigas, sem a informação, contam como entrega da loja (plano 2.2) */
    entregaPropria: boolean
}

/**
 * A venda é de plataforma? Pela forma do tipo PLATAFORMA (a plataforma pelo identificador), pelos textos antigos "(pago no
 * app)", ou pelo código que o PDV mandou na venda (inclusive paga em dinheiro). Venda antiga sem o código: pela plataforma
 * do pedido que a nuvem recebeu (pedidos.plataforma; a venda do pedido tem o mesmo código do pedido), só para código de
 * plataforma (cadastrada ou iFood/99), nunca "WEB" ou "PDV".
 */
export function vendaDePlataforma(
    l: LancamentoDoCaixa,
    formas: FormasDaPlataforma,
    plataformaDoPedido: string | null | undefined,
    codigosDePlataforma: Set<string>,
): VendaDePlataforma | null {
    if (l.is_withdrawal || l.is_addition) return null
    if (l.type && l.type !== 'SALE') return null
    if (!(Number(l.amount) > 0)) return null

    const metodo = normalizarNome(l.payment_method)
    const doLancamento = codigoDePlataforma(l.platform_code)
    const doIdentificador = formas.identificadores.get(metodo) ?? null
    const antigo = plataformaDoTextoAntigo(l.payment_method)
    const pagoNoApp = Boolean(doIdentificador) || formas.formas.has(metodo) || Boolean(antigo)
    const pedido = codigoDePlataforma(plataformaDoPedido)
    const doPedido = pedido && codigosDePlataforma.has(pedido) ? pedido : null

    if (!pagoNoApp && !doLancamento && !doPedido) return null
    return {
        codigo: doLancamento ?? doIdentificador ?? antigo?.codigo ?? doPedido,
        pagoNoApp,
        entregaPropria: l.platform_own_delivery ?? true,
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Valores do pedido da plataforma (tabela pedido_valores_plataforma, 15/10/2026): "conta corrente da plataforma"
// ---------------------------------------------------------------------------------------------------------------

/** O que a conferência usa da linha do pedido (services/valores-da-plataforma.ts). O código da venda é o uuid do pedido. */
export interface ValoresDaVenda {
    platform?: string
    items_value: number | null
    delivery_fee: number | null
    service_fee: number | null
    discount_store: number | null
    discount_platform: number | null
    discount_other: number | null
    customer_paid: number | null
    paid_online: boolean
    own_delivery: boolean | null
    expected_gross: number | null
    /** pedidos.valor_final: o total do pedido que o PDV recebeu (a venda) */
    valor_do_pedido?: number | null
}

/** O que uma venda (um lançamento) de plataforma põe do lado da plataforma: receita, bases da comissão e o detalhe do texto. */
export interface BasesDaVenda {
    /** Receita pendente (o que a plataforma vai pagar à loja por esta venda) */
    repasse: number
    /** Sobre o que se calcula a comissão (% da entrega da loja ou da plataforma) */
    baseComissao: number
    /** Sobre o que se calcula a taxa do pagamento online (0 quando pago na entrega) */
    baseTaxaOnline: number
    entregaPropria: boolean
    /** Usou os valores da plataforma (false = venda antiga ou sem dados: como antes) */
    comValores: boolean
    /** Para o texto do repasse: o incentivo da plataforma que a venda não tem, a taxa de serviço e o frete da entrega da
     *  plataforma (que não são da loja) e o que sobrar (a venda no caixa diferente do pedido) */
    incentivo: number
    taxaDeServico: number
    freteDaPlataforma: number
    outraDiferenca: number
}

/**
 * Base de cálculo de UMA venda de plataforma. É o único lugar da regra, aprovada pelo Thomás em 15/10/2026 ("conta corrente
 * da plataforma") e que ainda vai ser confirmada com o extrato real (comissão com ou sem o frete, antes ou depois do desconto
 * da loja). A venda e o caixa NÃO mudam: isto é só o lado da plataforma.
 *
 * Sem os valores da plataforma (venda antiga, 99 sem dados): como antes, tudo sobre o valor da venda; pago no app vira repasse.
 * Com os valores:
 * - PAGO NO APP: (+) repasse = expected_gross (itens + frete da entrega da loja − desconto da loja: inclui o incentivo da
 *   plataforma e não inclui a taxa de serviço); (−) comissão sobre expected_gross; (−) taxa online sobre o que o cliente pagou;
 * - PAGO NA ENTREGA (dinheiro ou maquininha da loja): o dinheiro segue o caminho de sempre (gaveta/maquininha); do lado da
 *   plataforma, (+) só o desconto que a PLATAFORMA bancou (ela deve isso à loja) e (−) a comissão sobre expected_gross; sem
 *   taxa online.
 * "Pago no app" é o que o caixa registrou (a forma do lançamento), porque é o caminho que o dinheiro fez de verdade.
 * Quem entregou: o que a plataforma disse (deliveredBy / delivery_type); sem isso, o que o PDV mandou; sem nada, a loja.
 * parte: a fração da venda neste lançamento (venda paga em mais de um lançamento); 1 no caso normal.
 */
export function basesDaVendaDePlataforma(
    valorDoLancamento: number,
    venda: Pick<VendaDePlataforma, 'pagoNoApp' | 'entregaPropria'>,
    valores: ValoresDaVenda | null | undefined,
    parte = 1,
): BasesDaVenda {
    const valor = Number(valorDoLancamento) || 0
    const zerado = { incentivo: 0, taxaDeServico: 0, freteDaPlataforma: 0, outraDiferenca: 0 }
    if (!valores || valores.expected_gross == null || !(parte > 0)) {
        return {
            repasse: venda.pagoNoApp ? valor : 0,
            baseComissao: valor,
            baseTaxaOnline: venda.pagoNoApp ? valor : 0,
            entregaPropria: venda.entregaPropria,
            comValores: false,
            ...zerado,
        }
    }

    const entregaPropria = valores.own_delivery ?? venda.entregaPropria
    const bruto = valores.expected_gross * parte

    if (!venda.pagoNoApp) {
        const incentivo = Math.max(0, (valores.discount_platform ?? 0) * parte)
        return { repasse: incentivo, baseComissao: bruto, baseTaxaOnline: 0, entregaPropria, comValores: true, ...zerado, incentivo }
    }

    const taxaDeServico = (valores.service_fee ?? 0) * parte
    const freteDaPlataforma = valores.own_delivery === false ? (valores.delivery_fee ?? 0) * parte : 0
    const incentivoDaPlataforma = ((valores.discount_platform ?? 0) + (valores.discount_other ?? 0)) * parte
    // O que o repasse tem a mais que a venda, fora a taxa e o frete que não são da loja. No iFood a venda é o que o cliente pagou
    // (o incentivo do iFood fica de fora dela); na 99 a venda já vem com o incentivo da 99 (real_price). Por isso a conta.
    const sobra = bruto - valor + taxaDeServico + freteDaPlataforma
    const incentivoForaDaVenda = Math.abs(sobra - incentivoDaPlataforma) < Math.abs(sobra) ? incentivoDaPlataforma : 0
    return {
        repasse: bruto,
        baseComissao: bruto,
        baseTaxaOnline: valores.customer_paid != null ? valores.customer_paid * parte : valor,
        entregaPropria,
        comValores: true,
        incentivo: incentivoForaDaVenda,
        taxaDeServico,
        freteDaPlataforma,
        outraDiferenca: sobra - incentivoForaDaVenda,
    }
}

/** Resumo, por plataforma, das vendas que usaram os valores da plataforma (para o texto do repasse). */
export interface DetalheDoRepasse {
    vendasNoApp: number
    /** Soma das vendas pagas no app (como estão no caixa) */
    valorDasVendas: number
    /** Soma do repasse dessas vendas */
    repasseDasVendas: number
    incentivo: number
    taxaDeServico: number
    freteDaPlataforma: number
    outraDiferenca: number
    /** Vendas pagas na entrega com desconto bancado pela plataforma, e o total desse desconto (receita) */
    vendasNaEntrega: number
    incentivoNaEntrega: number
}

const arredondarDetalhe = (d: DetalheDoRepasse): DetalheDoRepasse => ({
    ...d,
    valorDasVendas: arredondar(d.valorDasVendas),
    repasseDasVendas: arredondar(d.repasseDasVendas),
    incentivo: arredondar(d.incentivo),
    taxaDeServico: arredondar(d.taxaDeServico),
    freteDaPlataforma: arredondar(d.freteDaPlataforma),
    outraDiferenca: arredondar(d.outraDiferenca),
    incentivoNaEntrega: arredondar(d.incentivoNaEntrega),
})

const detalheVazio = (): DetalheDoRepasse => ({
    vendasNoApp: 0, valorDasVendas: 0, repasseDasVendas: 0, incentivo: 0, taxaDeServico: 0, freteDaPlataforma: 0,
    outraDiferenca: 0, vendasNaEntrega: 0, incentivoNaEntrega: 0,
})

/** "do iFood", "da 99Food" */
function daPlataforma(nome: string): string {
    return /^99/.test(normalizarNome(nome)) ? `da ${nome}` : `do ${nome}`
}

/**
 * O texto que explica a diferença entre o repasse e as vendas, no lançamento do repasse. Ex.: "valores do iFood em 1
 * venda(s) paga(s) no app: vendas R$ 53,32, repasse R$ 60,89; inclui incentivo do iFood R$ 8,97; sem a taxa de serviço R$ 1,40".
 * Vazio quando nenhuma venda usou os valores da plataforma.
 */
export function textoDoDetalheDoRepasse(nome: string, d: DetalheDoRepasse): string {
    const partes: string[] = []
    if (d.vendasNoApp > 0) {
        partes.push(`valores ${daPlataforma(nome)} em ${d.vendasNoApp} venda(s) paga(s) no app: vendas ${moeda(d.valorDasVendas)}, repasse ${moeda(d.repasseDasVendas)}`)
        if (arredondar(d.incentivo) >= 0.01) partes.push(`inclui incentivo ${daPlataforma(nome)} ${moeda(d.incentivo)}`)
        if (arredondar(d.taxaDeServico) >= 0.01) partes.push(`sem a taxa de serviço ${moeda(d.taxaDeServico)}`)
        if (arredondar(d.freteDaPlataforma) >= 0.01) partes.push(`sem o frete da entrega ${daPlataforma(nome)} ${moeda(d.freteDaPlataforma)}`)
        if (Math.abs(arredondar(d.outraDiferenca)) >= 0.01) partes.push(`diferença de ${moeda(d.outraDiferenca)} entre a venda no caixa e o pedido`)
    }
    if (d.vendasNaEntrega > 0 && arredondar(d.incentivoNaEntrega) >= 0.01) {
        partes.push(`incentivo ${daPlataforma(nome)} ${moeda(d.incentivoNaEntrega)} de ${d.vendasNaEntrega} venda(s) paga(s) na entrega`)
    }
    return partes.join('; ')
}

// ---------------------------------------------------------------------------------------------------------------
// O que a conferência lança para as plataformas
// ---------------------------------------------------------------------------------------------------------------

export interface GrupoDaPlataforma {
    plataforma: PlataformaCadastrada
    dataRepasse: string
    /** A receita pendente (o repasse): as pagas no app pelo valor cheio, ou pelo expected_gross quando a venda tem os valores da
     *  plataforma; as pagas na entrega com os valores, o desconto que a plataforma bancou (basesDaVendaDePlataforma) */
    receita: number
    /** Comissão (loja entrega × plataforma entrega) de todas as vendas + taxa online das pagas no app: a despesa pendente */
    comissao: number
    vendas: number
    vendasNoApp: number
    /** O que veio dos valores da plataforma (15/10/2026), para o texto do repasse */
    detalhe: DetalheDoRepasse
}

export interface PlanoDasPlataformas {
    grupos: GrupoDaPlataforma[]
    /** Lançamentos pagos no app que viraram repasse: não entram na maquininha nem no a prazo */
    noRepasse: Set<string>
    /** Para a resposta da conferência ("cadastre a plataforma X") */
    avisos: string[]
}

export interface ContextoDasPlataformas {
    plataformas: PlataformaCadastrada[]
    formas: FormasDaPlataforma
    /** sale_id → pedidos.plataforma */
    plataformaDoPedido: Map<string, string>
    /** sale_id → valores da plataforma do pedido (15/10/2026); sem a linha, a venda segue como antes */
    valoresDaVenda?: Map<string, ValoresDaVenda>
}

/**
 * Um grupo por plataforma no caixa (todas as vendas de um caixa são do mesmo dia operacional, então da mesma data de
 * repasse). Plataforma sem cadastro: as vendas ficam como hoje (o pago no app vira um "a receber" vencendo no dia, sem
 * comissão) e a resposta avisa para cadastrar.
 */
export function planoDasPlataformas(
    lancamentos: LancamentoDoCaixa[],
    ctx: ContextoDasPlataformas,
    diaDoCaixa: string,
): PlanoDasPlataformas {
    const porCodigo = new Map(ctx.plataformas.map(p => [codigoDePlataforma(p.code) ?? p.code, p]))
    const codigos = new Set<string>([...porCodigo.keys(), ...Object.keys(NOMES_CONHECIDOS)])
    const grupos = new Map<string, GrupoDaPlataforma & { comissaoBruta: number }>()
    const noRepasse = new Set<string>()
    const semCadastro = new Map<string, { vendas: number; total: number }>()
    const semPlataforma = { vendas: 0, total: 0 }
    const formaDiferente = new Map<string, number>()

    // Venda em mais de um lançamento: cada um leva a sua parte dos valores da plataforma (o valor dele ÷ o total da venda, que é
    // o maior entre o total do pedido e a soma dos lançamentos dela neste caixa)
    const somaDaVenda = new Map<string, number>()
    for (const l of lancamentos) {
        if (!l.sale_id || !ctx.valoresDaVenda?.has(l.sale_id)) continue
        if (!vendaDePlataforma(l, ctx.formas, ctx.plataformaDoPedido.get(l.sale_id), codigos)) continue
        somaDaVenda.set(l.sale_id, (somaDaVenda.get(l.sale_id) ?? 0) + Number(l.amount))
    }

    for (const l of lancamentos) {
        const venda = vendaDePlataforma(l, ctx.formas, l.sale_id ? ctx.plataformaDoPedido.get(l.sale_id) : null, codigos)
        if (!venda) continue
        const valor = Number(l.amount)
        if (!venda.codigo) {
            semPlataforma.vendas++
            semPlataforma.total += valor
            continue
        }
        const plataforma = porCodigo.get(venda.codigo)
        if (!plataforma) {
            const atual = semCadastro.get(venda.codigo) ?? { vendas: 0, total: 0 }
            atual.vendas++
            atual.total += valor
            semCadastro.set(venda.codigo, atual)
            continue
        }

        let grupo = grupos.get(plataforma.id)
        if (!grupo) {
            grupo = {
                plataforma,
                dataRepasse: dataDoRepasse(diaDoCaixa, plataforma.payout_weeks_after),
                receita: 0, comissao: 0, comissaoBruta: 0, vendas: 0, vendasNoApp: 0, detalhe: detalheVazio(),
            }
            grupos.set(plataforma.id, grupo)
        }

        const valores = l.sale_id ? ctx.valoresDaVenda?.get(l.sale_id) : undefined
        const totalDaVenda = l.sale_id ? Math.max(Number(valores?.valor_do_pedido) || 0, somaDaVenda.get(l.sale_id) ?? 0) : 0
        const bases = basesDaVendaDePlataforma(valor, venda, valores, totalDaVenda > 0 ? valor / totalDaVenda : 1)
        if (bases.comValores && valores && valores.paid_online !== venda.pagoNoApp) {
            formaDiferente.set(plataforma.name, (formaDiferente.get(plataforma.name) ?? 0) + 1)
        }

        const pctEntrega = bases.entregaPropria ? plataforma.commission_own_delivery_pct : plataforma.commission_platform_delivery_pct
        grupo.comissaoBruta += bases.baseComissao * (Number(pctEntrega) || 0) / 100
        grupo.comissaoBruta += bases.baseTaxaOnline * (Number(plataforma.online_payment_fee_pct) || 0) / 100
        grupo.receita += bases.repasse
        grupo.vendas++
        if (venda.pagoNoApp) {
            grupo.vendasNoApp++
            noRepasse.add(l.id)
        }
        if (bases.comValores) {
            const d = grupo.detalhe
            if (venda.pagoNoApp) {
                d.vendasNoApp++
                d.valorDasVendas += valor
                d.repasseDasVendas += bases.repasse
                d.incentivo += bases.incentivo
                d.taxaDeServico += bases.taxaDeServico
                d.freteDaPlataforma += bases.freteDaPlataforma
                d.outraDiferenca += bases.outraDiferenca
            } else if (bases.repasse > 0) {
                d.vendasNaEntrega++
                d.incentivoNaEntrega += bases.repasse
            }
        }
    }

    const avisos: string[] = []
    for (const [codigo, s] of semCadastro) {
        const nome = NOMES_CONHECIDOS[codigo] ?? codigo
        avisos.push(`Cadastre a plataforma ${nome} em Plataformas: ${s.vendas} venda(s) dela (${moeda(s.total)}) ficaram como antes, sem a comissão, e o que foi pago no app vence no dia.`)
    }
    for (const [nome, n] of formaDiferente) {
        avisos.push(`${n} venda(s) ${daPlataforma(nome)} com a forma diferente da que a plataforma informou (pago no app × na entrega): conferida(s) pela forma que o caixa registrou.`)
    }
    if (semPlataforma.vendas > 0) {
        avisos.push(`${semPlataforma.vendas} venda(s) paga(s) no app (${moeda(semPlataforma.total)}) não dizem de qual plataforma são e ficaram como antes. Ligue cada identificador da forma "Pago na plataforma" à sua plataforma.`)
    }

    return {
        grupos: [...grupos.values()].map(({ comissaoBruta, detalhe, ...g }) => ({
            ...g,
            receita: arredondar(g.receita),
            comissao: arredondar(comissaoBruta),
            detalhe: arredondarDetalhe(detalhe),
        })),
        noRepasse,
        avisos,
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Despesa do caixa com setor e forma (plano 2.4)
// ---------------------------------------------------------------------------------------------------------------

/** Saída do caixa paga no Pix (o acerto do motoboy no Pix): não sai da gaveta nem do saldo do Caixa Central. */
export function ehPix(metodo: string | null | undefined): boolean {
    return normalizarNome(metodo).includes('pix')
}

/** A saída tira dinheiro da gaveta? (sangria, vale e despesa em dinheiro sim; a paga no Pix não) */
export function saiDaGaveta(l: { is_withdrawal: boolean; payment_method: string | null }): boolean {
    return l.is_withdrawal && !ehPix(l.payment_method)
}

/**
 * A conta da forma Pix, para a despesa paga no Pix: a forma chamada "Pix" (ou, sem ela, a primeira que tem "pix" no nome),
 * que não seja do tipo Plataforma. Sem conta ligada = null: a despesa fica pendente, sem conta, e o dono baixa escolhendo.
 */
export function contaDaFormaPix(formas: { name: string; kind: string | null; account_id: string | null; active?: boolean }[]): string | null {
    const candidatas = formas.filter(f => (f.kind || '').toUpperCase() !== KIND_PLATAFORMA && f.active !== false && normalizarNome(f.name).includes('pix'))
    const exata = candidatas.find(f => normalizarNome(f.name) === 'pix')
    return (exata ?? candidatas[0])?.account_id ?? null
}

/** Texto antigo do acerto do motoboy ("SaidaOperacional: [Motoboy] Acerto de ..."): vai para o setor "Motoboy". */
export function ehDespesaDoMotoboy(identificacao: string | null | undefined): boolean {
    return normalizarNome(identificacao).includes('[motoboy]')
}

/**
 * Setor da despesa que o PDV mandou: a Categoria (ex.: "Motoboy"), ou "Motoboy" para o texto antigo do acerto. Sem nada =
 * null (não mexe no setor que alguém escolheu na web).
 */
export function setorDaDespesa(categoria: string | null | undefined, identificacao: string | null | undefined): string | null {
    const c = (categoria ?? '').replace(/\s+/g, ' ').trim()
    if (c) return normalizarNome(c) === normalizarNome(SETOR_MOTOBOY) ? SETOR_MOTOBOY : c
    return ehDespesaDoMotoboy(identificacao) ? SETOR_MOTOBOY : null
}

/** O setor com esse nome, sem diferenciar acento nem maiúscula ("motoboy" = "Motoboy", "Taxas de Plataforma" = "taxas de plataforma"). */
export function acharSetorPeloNome<T extends { name: string }>(setores: T[], nome: string): T | null {
    const alvo = normalizarNome(nome)
    return setores.find(s => normalizarNome(s.name) === alvo) ?? null
}
