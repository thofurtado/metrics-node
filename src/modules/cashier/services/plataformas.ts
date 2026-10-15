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
// O que a conferência lança para as plataformas
// ---------------------------------------------------------------------------------------------------------------

export interface GrupoDaPlataforma {
    plataforma: PlataformaCadastrada
    dataRepasse: string
    /** Soma das vendas pagas no app, valor cheio: a receita pendente (o repasse) */
    receita: number
    /** Comissão (loja entrega × plataforma entrega) de todas as vendas + taxa online das pagas no app: a despesa pendente */
    comissao: number
    vendas: number
    vendasNoApp: number
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
                receita: 0, comissao: 0, comissaoBruta: 0, vendas: 0, vendasNoApp: 0,
            }
            grupos.set(plataforma.id, grupo)
        }
        const pctEntrega = venda.entregaPropria ? plataforma.commission_own_delivery_pct : plataforma.commission_platform_delivery_pct
        grupo.comissaoBruta += valor * (Number(pctEntrega) || 0) / 100
        grupo.vendas++
        if (venda.pagoNoApp) {
            grupo.receita += valor
            grupo.comissaoBruta += valor * (Number(plataforma.online_payment_fee_pct) || 0) / 100
            grupo.vendasNoApp++
            noRepasse.add(l.id)
        }
    }

    const avisos: string[] = []
    for (const [codigo, s] of semCadastro) {
        const nome = NOMES_CONHECIDOS[codigo] ?? codigo
        avisos.push(`Cadastre a plataforma ${nome} em Plataformas: ${s.vendas} venda(s) dela (${moeda(s.total)}) ficaram como antes, sem a comissão, e o que foi pago no app vence no dia.`)
    }
    if (semPlataforma.vendas > 0) {
        avisos.push(`${semPlataforma.vendas} venda(s) paga(s) no app (${moeda(semPlataforma.total)}) não dizem de qual plataforma são e ficaram como antes. Ligue cada identificador da forma "Pago na plataforma" à sua plataforma.`)
    }

    return {
        grupos: [...grupos.values()].map(({ comissaoBruta, ...g }) => ({ ...g, receita: arredondar(g.receita), comissao: arredondar(comissaoBruta) })),
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
