/**
 * Motoboys do PDV na nuvem (15/10/2026, plano 2.5 de _claude-sync/relatorios/PLANO-PLATAFORMAS-E-MOTOBOY.md). O PDV é a fonte
 * (Motoboy e EntregaAPagar); a nuvem guarda uma cópia para o relatório dos motoboys na web. Funções puras: a rota de
 * sincronia e o relatório usam as mesmas regras, e os testes também.
 */

export type FormaDeGanho = 'FIXO' | 'PERCENTUAL'
export type TipoDaEntrega = 'ENTREGA' | 'DIARIA'
export type SituacaoDaEntrega = 'PENDENTE' | 'PAGA' | 'NAO_PAGA'

export interface MotoboyDoPdv {
    Uuid: string
    Nome: string
    Telefone?: string | null
    FormaGanho?: string | null
    ValorPorEntrega?: number | null
    Diaria?: number | null
    Ativo?: boolean | null
    GanhoDesde?: string | null
}

export interface EntregaAPagarDoPdv {
    Uuid: string
    MotoboyUuid: string
    Tipo?: string | null
    PedidoUuid?: string | null
    Data?: string | null
    Dia?: string | null
    Descricao?: string | null
    TaxaCobrada?: number | null
    ValorAPagar?: number | null
    Situacao?: string | null
    Motivo?: string | null
    AcertoUuid?: string | null
    PagoEm?: string | null
    FormaPagamento?: string | null
}

const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100) / 100

const semAcento = (t: string | null | undefined) =>
    (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s-]+/g, '_').trim()

/** Data do PDV (ISO); inválida ou vazia = null. */
export function dataOuNulo(texto: string | null | undefined): Date | null {
    if (!texto) return null
    const d = new Date(texto)
    return Number.isNaN(d.getTime()) ? null : d
}

/** Dia aaaa-mm-dd do PDV; se não vier certo, o dia de Brasília da data da entrega. */
export function diaDaEntrega(dia: string | null | undefined, data: Date): string {
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia.trim())) return dia.trim()
    return new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function formaDeGanho(texto: string | null | undefined): FormaDeGanho {
    return semAcento(texto).startsWith('PERCENT') ? 'PERCENTUAL' : 'FIXO'
}

export function tipoDaEntrega(texto: string | null | undefined): TipoDaEntrega {
    return semAcento(texto).startsWith('DIARIA') ? 'DIARIA' : 'ENTREGA'
}

/** PENDENTE, PAGA ou NAO_PAGA ("Não paga", "nao_paga", "PAGO" também). Desconhecida = PENDENTE (nada some do que falta pagar). */
export function situacaoDaEntrega(texto: string | null | undefined): SituacaoDaEntrega {
    const s = semAcento(texto)
    if (s.startsWith('NAO_PAG') || s === 'NAOPAGA' || s === 'CANCELADA') return 'NAO_PAGA'
    if (s === 'PAGA' || s === 'PAGO') return 'PAGA'
    return 'PENDENTE'
}

/** "Dinheiro", "Pix" ou null (o PDV só paga o motoboy nessas duas). */
export function formaDoPagamento(texto: string | null | undefined): 'Dinheiro' | 'Pix' | null {
    const s = semAcento(texto)
    if (!s) return null
    if (s.includes('PIX')) return 'Pix'
    if (s.includes('DINHEIRO')) return 'Dinheiro'
    return null
}

export function normalizarMotoboy(m: MotoboyDoPdv) {
    return {
        id: m.Uuid,
        name: m.Nome.trim(),
        phone: m.Telefone?.trim() || null,
        earning_mode: formaDeGanho(m.FormaGanho),
        value_per_delivery: centavos(m.ValorPorEntrega),
        daily_rate: centavos(m.Diaria),
        active: m.Ativo ?? true,
        earning_since: dataOuNulo(m.GanhoDesde),
    }
}

export function normalizarEntregaAPagar(e: EntregaAPagarDoPdv, motoboyJaChegou: boolean) {
    const data = dataOuNulo(e.Data) ?? (e.Dia ? dataOuNulo(`${e.Dia}T15:00:00.000Z`) : null) ?? new Date()
    return {
        id: e.Uuid,
        courier_uuid: e.MotoboyUuid,
        courier_id: motoboyJaChegou ? e.MotoboyUuid : null,
        kind: tipoDaEntrega(e.Tipo),
        order_uuid: e.PedidoUuid?.trim() || null,
        occurred_at: data,
        day: diaDaEntrega(e.Dia, data),
        description: e.Descricao?.trim() || null,
        fee_charged: centavos(e.TaxaCobrada),
        amount_due: centavos(e.ValorAPagar),
        status: situacaoDaEntrega(e.Situacao),
        reason: e.Motivo?.trim() || null,
        settlement_uuid: e.AcertoUuid?.trim() || null,
        paid_at: dataOuNulo(e.PagoEm),
        payment_method: formaDoPagamento(e.FormaPagamento),
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Relatório dos motoboys (web): por motoboy, no período, entregas, diárias, ganho, pago por forma, pendente e o dia a dia
// ---------------------------------------------------------------------------------------------------------------

export interface LinhaAPagar {
    courier_uuid: string
    kind: string
    day: string
    amount_due: number
    status: string
    payment_method: string | null
}

export interface MotoboyCadastrado {
    id: string
    name: string
    active: boolean
    earning_mode: string
    value_per_delivery: number
    daily_rate: number
}

export interface TotaisDoMotoboy {
    entregas: number
    diarias: number
    nao_pagas: number
    /** Ganho = tudo que é devido (pago + pendente), sem as linhas "não paga" */
    ganho: number
    pago_dinheiro: number
    pago_pix: number
    /** Pago sem forma informada (PDV antigo) */
    pago_outros: number
    pago: number
    pendente: number
}

export interface DiaDoMotoboy extends TotaisDoMotoboy {
    dia: string
}

export interface MotoboyNoRelatorio extends TotaisDoMotoboy {
    id: string
    nome: string
    ativo: boolean
    forma_ganho: string
    valor_por_entrega: number
    diaria: number
    /** O cadastro do motoboy ainda não subiu do PDV */
    sem_cadastro: boolean
    dias: DiaDoMotoboy[]
}

function totaisVazios(): TotaisDoMotoboy {
    return { entregas: 0, diarias: 0, nao_pagas: 0, ganho: 0, pago_dinheiro: 0, pago_pix: 0, pago_outros: 0, pago: 0, pendente: 0 }
}

function somar(t: TotaisDoMotoboy, l: LinhaAPagar) {
    const valor = Number(l.amount_due) || 0
    const situacao = situacaoDaEntrega(l.status)
    if (situacao === 'NAO_PAGA') {
        t.nao_pagas++
        return
    }
    if (tipoDaEntrega(l.kind) === 'DIARIA') t.diarias++
    else t.entregas++
    t.ganho += valor
    if (situacao === 'PAGA') {
        t.pago += valor
        const forma = formaDoPagamento(l.payment_method)
        if (forma === 'Pix') t.pago_pix += valor
        else if (forma === 'Dinheiro') t.pago_dinheiro += valor
        else t.pago_outros += valor
    } else {
        t.pendente += valor
    }
}

function arredondarTotais<T extends TotaisDoMotoboy>(t: T): T {
    for (const k of ['ganho', 'pago_dinheiro', 'pago_pix', 'pago_outros', 'pago', 'pendente'] as const) t[k] = centavos(t[k])
    return t
}

export function relatorioDosMotoboys(linhas: LinhaAPagar[], motoboys: MotoboyCadastrado[]) {
    const porMotoboy = new Map<string, { totais: TotaisDoMotoboy; dias: Map<string, TotaisDoMotoboy> }>()
    for (const l of linhas) {
        let m = porMotoboy.get(l.courier_uuid)
        if (!m) {
            m = { totais: totaisVazios(), dias: new Map() }
            porMotoboy.set(l.courier_uuid, m)
        }
        somar(m.totais, l)
        let dia = m.dias.get(l.day)
        if (!dia) {
            dia = totaisVazios()
            m.dias.set(l.day, dia)
        }
        somar(dia, l)
    }

    const cadastro = new Map(motoboys.map(m => [m.id, m]))
    const resultado: MotoboyNoRelatorio[] = []
    // Todo motoboy cadastrado aparece (mesmo sem entrega no período, se estiver ativo), e o que só tem entregas também
    const ids = new Set<string>([...motoboys.filter(m => m.active).map(m => m.id), ...porMotoboy.keys()])
    for (const id of ids) {
        const c = cadastro.get(id)
        const m = porMotoboy.get(id)
        resultado.push(arredondarTotais({
            id,
            nome: c?.name ?? 'Motoboy ainda não enviado pelo PDV',
            ativo: c?.active ?? true,
            forma_ganho: c?.earning_mode ?? 'FIXO',
            valor_por_entrega: c?.value_per_delivery ?? 0,
            diaria: c?.daily_rate ?? 0,
            sem_cadastro: !c,
            ...(m?.totais ?? totaisVazios()),
            dias: [...(m?.dias ?? new Map<string, TotaisDoMotoboy>()).entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dia, t]) => arredondarTotais({ dia, ...t })),
        }))
    }
    resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const totais = totaisVazios()
    for (const m of resultado) {
        for (const k of Object.keys(totais) as (keyof TotaisDoMotoboy)[]) totais[k] += m[k]
    }
    return { motoboys: resultado, totais: arredondarTotais(totais) }
}
