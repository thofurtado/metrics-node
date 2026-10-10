/**
 * Conta do cliente (fiado do PDV) no financeiro — 10/10/2026.
 *
 * Decisão do Thomás de 25/09/2026: "o registro oficial do fiado é a conta do cliente (client_tabs: quanto deve e de quais
 * vendas; baixa quando paga); o financeiro lê o total a receber dessas contas; a conferência não cria outra receita a prazo
 * para o mesmo fiado". Até 10/10 a conta só existia para o PDV: a tela "Clientes a Prazo" não a via, a baixa na web quitava
 * só a receita que a conferência criava de novo, e o PDV continuava mostrando a dívida para sempre.
 *
 * Na lista "Clientes a Prazo" cada conta aberta aparece como um recebível com id `tab-<id da conta>` (como o vale do RH
 * aparece com `payroll-`), e a baixa (`/settle-term-debt`) quita a conta: inteira, parcial (a conta vira "paga" com o valor
 * recebido e o saldo fica numa conta aberta da mesma venda) ou por permuta (quita sem dinheiro).
 */

export const PREFIXO_CONTA = 'tab-'

/** Prazo do fiado para "vencido" na tela: 30 dias, o mesmo que a conferência usava na receita a prazo. */
export const DIAS_DO_FIADO = 30

export interface ContaDoCliente {
    id: string
    client_id: string
    amount: number
    description: string | null
    created_at: Date
    client?: { id: string; name: string } | null
}

export interface RecebivelDaConta {
    id: string
    amount: number
    totalValue: number
    description: string
    data_emissao: Date
    data_vencimento: Date
    payment_method: string
    interest: number
    isClientTab: true
    client: { id: string; name: string } | null
    clientId: string
}

const cents = (valor: number) => Math.round(valor * 100)

export function vencimentoDaConta(criadaEm: Date): Date {
    const vencimento = new Date(criadaEm)
    vencimento.setDate(vencimento.getDate() + DIAS_DO_FIADO)
    return vencimento
}

/** A conta aberta como item da lista "Clientes a Prazo" (o mesmo formato das receitas a prazo, com o cliente junto). */
export function contaComoRecebivel(conta: ContaDoCliente): RecebivelDaConta {
    return {
        id: `${PREFIXO_CONTA}${conta.id}`,
        amount: conta.amount,
        totalValue: conta.amount,
        description: conta.description || 'Venda a Prazo',
        data_emissao: conta.created_at,
        data_vencimento: vencimentoDaConta(conta.created_at),
        payment_method: 'A PRAZO',
        interest: 0,
        isClientTab: true,
        client: conta.client ? { id: conta.client.id, name: conta.client.name } : null,
        clientId: conta.client_id,
    }
}

/**
 * Quanto a baixa recebe e quanto fica devendo. Parcial só quando é uma conta só e o valor pago é menor que o da conta (como
 * a baixa parcial das receitas); valor pago maior que a conta recebe só a conta.
 */
export function baixaDaConta(valorDaConta: number, valorPago: number | null | undefined, umaContaSo: boolean): { recebido: number; saldo: number } {
    const total = cents(valorDaConta)
    const pago = umaContaSo && valorPago && valorPago > 0 ? Math.min(cents(valorPago), total) : total
    return { recebido: pago / 100, saldo: (total - pago) / 100 }
}

export interface Intervalo {
    gte?: Date
    lt?: Date
    lte?: Date
}

/**
 * Filtro da data de criação das contas que VENCEM no intervalo (o vencimento é a criação + 30 dias): para o painel do
 * financeiro somar o fiado do PDV no "a receber do mês" e no "a receber vencido", como soma as receitas a prazo.
 */
export function criadasParaVencerEm(vencimento: Intervalo): Intervalo {
    const antes = (data: Date) => {
        const d = new Date(data)
        d.setDate(d.getDate() - DIAS_DO_FIADO)
        return d
    }
    const filtro: Intervalo = {}
    if (vencimento.gte) filtro.gte = antes(vencimento.gte)
    if (vencimento.lt) filtro.lt = antes(vencimento.lt)
    if (vencimento.lte) filtro.lte = antes(vencimento.lte)
    return filtro
}

/**
 * Contas que entram no mês escolhido na tela: criadas no mês ou vencendo nele (o mesmo critério das receitas a prazo:
 * emissão ou vencimento no mês).
 */
export function janelaDasContasDoMes(mes: number, ano: number): { desde: Date; ate: Date } {
    const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0)
    const ate = new Date(ano, mes, 0, 23, 59, 59, 999)
    const desde = new Date(inicio)
    desde.setDate(desde.getDate() - DIAS_DO_FIADO)
    return { desde, ate }
}
