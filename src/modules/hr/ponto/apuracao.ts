// A conta única do ponto (passo 1 da ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md, 07/10/2026).
// Antes a mesma conta estava em 4 lugares com números diferentes (espelho, resumo do mês, PDF e servidor). Agora todos pedem
// esta. Função pura: recebe os dias, os feriados e as regras; devolve as horas por tipo, os valores e os avisos.
//
// Princípios (D18): as horas são sempre contadas como aconteceram; o valor segue a regra da loja; o que fica fora da lei vira
// aviso, nunca bloqueio.

import { Decimal } from 'decimal.js'

import { RegraDaLoja, regraDoDia } from './regra'

export type TipoDeFuncionario = 'REGISTERED' | 'UNREGISTERED' | 'DAILY' | 'HOURLY'

export interface FuncionarioDaConta {
  tipo: TipoDeFuncionario | string
  /** Salário mensal (registrado e sem registro) ou valor da hora (horista) */
  salario: number | null
  /** Valor da diária (diarista) */
  diaria: number | null
  /** Valor da hora extra combinado (D15). 0 ou null = calculado pela regra */
  valorHoraExtra: number | null
}

/** Um dia do ponto (igual à tabela time_clocks; as horas em UTC, como o banco guarda) */
export interface DiaDePonto {
  /** yyyy-mm-dd (dia de competência: o dia vira às 04:00 de Brasília) */
  data: string
  entrada: Date | null
  saidaIntervalo: Date | null
  voltaIntervalo: Date | null
  saida: Date | null
  entradaExtra: Date | null
  saidaExtra: Date | null
  /** Dia de "dobra": pago pelo valor combinado, fora da conta de hora extra (D17) */
  dobra: boolean
  valorDobra: number | null
  /** ATESTADO, FALTA_JUSTIFICADA, FALTA_INJUSTIFICADA ou null */
  ausencia: string | null
}

export type TipoDeAviso =
  | 'DIA_ACIMA_10H'
  | 'INTERVALO_MENOR_1H'
  | 'MENOS_DE_11H_ENTRE_JORNADAS'
  | 'BATIDA_INCOMPLETA'
  | 'BATIDA_FORA_DE_ORDEM'

export interface AvisoDoDia {
  tipo: TipoDeAviso
  texto: string
}

export interface ApuracaoDoDia {
  data: string
  situacao: 'TRABALHADO' | 'DOBRA' | 'FOLGA' | 'ATESTADO' | 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA'
  domingo: boolean
  feriado: boolean
  /** Minutos trabalhados de verdade (sem o intervalo) */
  trabalhadosMin: number
  /** Atestado e falta justificada contam a jornada do dia para mostrar (não entram na hora extra) */
  virtuaisMin: number
  intervaloMin: number | null
  jornadaMin: number
  /** Extra no dia, 1ª faixa (ex.: 50%) */
  extraMin: number
  /** Extra no dia, 2ª faixa (se a regra tiver) */
  extraSegundaFaixaMin: number
  /** Domingo ou feriado (100%) */
  extraEspecialMin: number
  /** Extra pela semana (acima de 44h), lançada no domingo que fecha a semana */
  extraSemanaMin: number
  /** Minutos entre 22h e 5h no relógio */
  noturnosMin: number
  /** Os mesmos minutos contados com a hora noturna reduzida (52min30s), quando a regra pede */
  noturnosPagosMin: number
  valorExtra: number
  valorNoturno: number
  /** Valor da dobra (o dia substitui a diária, D17) */
  valorDobra: number
  regra: string
  avisos: AvisoDoDia[]
}

export interface TotaisDoPeriodo {
  trabalhadosMin: number
  virtuaisMin: number
  diasTrabalhados: number
  dobras: number
  atestados: number
  faltasJustificadas: number
  faltasInjustificadas: number
  extraMin: number
  extraSegundaFaixaMin: number
  extraEspecialMin: number
  extraSemanaMin: number
  noturnosMin: number
  noturnosPagosMin: number
  valorExtra: number
  valorExtraNormal: number
  valorExtraSegundaFaixa: number
  valorExtraEspecial: number
  valorNoturno: number
  valorDobras: number
  avisos: Record<TipoDeAviso, number>
}

export interface ResultadoDaApuracao {
  dias: ApuracaoDoDia[]
  totais: TotaisDoPeriodo
  /** Valor da hora normal usado na conta (salário ÷ divisor, diária ÷ horas da diária ou a hora do horista) */
  valorHora: number
  /** Valor da hora extra comum (o combinado do funcionário ou o calculado) */
  valorHoraExtra: number
  /** A regra do último dia do período, para a tela mostrar os percentuais */
  regra: RegraDaLoja
}

const MIN = 60_000
const NOITE_INICIO = 22 * 60
const NOITE_FIM = 5 * 60

/**
 * Duração de um trecho em ms. Fim antes do início:
 * - por 6 horas ou mais = virou a meia-noite (ex.: 22h às 2h gravado no mesmo dia): soma 24h;
 * - por menos de 6 horas = batida fora de ordem (ex.: saída para o intervalo às 17:00 com entrada às 17:02, Marujo, 07/09/2026):
 *   o trecho não conta e vira aviso. Antes o servidor somava 24h e o dia ficava com quase 24 horas a mais.
 * null = fora de ordem.
 */
function duracaoMs(inicio: Date, fim: Date): number | null {
  const d = fim.getTime() - inicio.getTime()
  if (d >= 0) return d
  if (d > -6 * 60 * MIN) return null
  return d + 24 * 60 * MIN
}

/** Os trechos trabalhados do dia (entrada → saída para o intervalo, ou → saída; volta → saída; extra) */
export function trechosDoDia(d: DiaDePonto): { trechos: Array<[Date, Date]>; foraDeOrdem: boolean } {
  const trechos: Array<[Date, Date]> = []
  let foraDeOrdem = false
  const fecha = (ini: Date, fim: Date) => {
    const ms = duracaoMs(ini, fim)
    if (ms === null) { foraDeOrdem = true; return }
    trechos.push([ini, new Date(ini.getTime() + ms)])
  }
  if (d.entrada) {
    const fimTurno1 = d.saidaIntervalo ?? d.saida
    if (fimTurno1) fecha(d.entrada, fimTurno1)
  }
  if (d.voltaIntervalo && d.saida) fecha(d.voltaIntervalo, d.saida)
  if (d.entradaExtra && d.saidaExtra) fecha(d.entradaExtra, d.saidaExtra)
  return { trechos, foraDeOrdem }
}

const formatoBrasilia = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Diferença entre a hora de Brasília e o UTC naquele instante, em ms (-3h; acompanha qualquer mudança de fuso) */
function deslocamentoBrasilia(instante: Date): number {
  const p: Record<string, number> = {}
  for (const parte of formatoBrasilia.formatToParts(instante)) {
    if (parte.type !== 'literal') p[parte.type] = Number(parte.value)
  }
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000
}

/** Minutos de um trecho que caem entre 22h e 5h no relógio de Brasília (CLT, art. 73, § 2º) */
export function minutosNoturnos(inicio: Date, fim: Date): number {
  const ini = (inicio.getTime() + deslocamentoBrasilia(inicio)) / MIN
  const fi = (fim.getTime() + deslocamentoBrasilia(fim)) / MIN
  if (fi <= ini) return 0
  let total = 0
  const primeiroDia = Math.floor(ini / 1440) - 1
  const ultimoDia = Math.floor(fi / 1440)
  for (let dia = primeiroDia; dia <= ultimoDia; dia++) {
    const janelaIni = dia * 1440 + NOITE_INICIO
    const janelaFim = (dia + 1) * 1440 + NOITE_FIM
    const sobreposto = Math.min(fi, janelaFim) - Math.max(ini, janelaIni)
    if (sobreposto > 0) total += sobreposto
  }
  return Math.round(total)
}

/** Dia da semana de uma data yyyy-mm-dd (0 = domingo), sem depender do fuso do servidor */
function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00.000Z`).getUTCDay()
}

/** Segunda-feira da semana de uma data (a semana vai de segunda a domingo) */
function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00.000Z`)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().substring(0, 10)
}

function somaDias(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().substring(0, 10)
}

/** Valor da hora normal pela regra e pelo tipo do funcionário */
export function valorDaHora(f: FuncionarioDaConta, regra: RegraDaLoja): Decimal {
  const salario = new Decimal(f.salario ?? 0)
  switch (f.tipo) {
    case 'HOURLY':
      return salario
    case 'DAILY':
      return regra.diariaMin > 0 ? new Decimal(f.diaria ?? 0).div(regra.diariaMin / 60) : new Decimal(0)
    default:
      return regra.divisor > 0 ? salario.div(regra.divisor) : new Decimal(0)
  }
}

const fmtHoras = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`

export interface EntradaDaApuracao {
  funcionario: FuncionarioDaConta
  /** Os dias do ponto. Pode trazer dias antes do início (a semana que começa no mês anterior e a jornada de ontem) */
  dias: DiaDePonto[]
  /** Datas dos feriados, yyyy-mm-dd */
  feriados: string[]
  regras: RegraDaLoja[]
  /** Período que a tela mostra (yyyy-mm-dd, inclusive) */
  inicio: string
  fim: string
  /** Jornada combinada de um dia (horário combinado, passo 3). null/undefined = a jornada da regra */
  jornadaCombinada?: (data: string) => number | null | undefined
}

export function apurarPeriodo(entrada: EntradaDaApuracao): ResultadoDaApuracao {
  const { funcionario, feriados, regras, inicio, fim } = entrada
  const setFeriados = new Set(feriados.map((f) => f.substring(0, 10)))
  const porData = new Map<string, DiaDePonto>()
  for (const d of entrada.dias) porData.set(d.data.substring(0, 10), d)

  // Os dias contados vão da segunda-feira da 1ª semana até o fim (a semana do início pode começar no mês anterior)
  const primeiro = segundaDaSemana(inicio)
  const datas: string[] = []
  for (let d = primeiro; d <= fim; d = somaDias(d, 1)) datas.push(d)

  const diasCalculados: ApuracaoDoDia[] = []
  let ultimaSaida: Date | null = null

  for (const data of datas) {
    const regra = regraDoDia(regras, data)
    const ponto = porData.get(data)
    const domingo = diaDaSemana(data) === 0
    const feriado = setFeriados.has(data)
    const combinada = entrada.jornadaCombinada?.(data)
    const jornadaMin = combinada ?? regra.jornadaDiariaMin
    const avisos: AvisoDoDia[] = []

    const dia: ApuracaoDoDia = {
      data, situacao: 'FOLGA', domingo, feriado,
      trabalhadosMin: 0, virtuaisMin: 0, intervaloMin: null, jornadaMin,
      extraMin: 0, extraSegundaFaixaMin: 0, extraEspecialMin: 0, extraSemanaMin: 0,
      noturnosMin: 0, noturnosPagosMin: 0, valorExtra: 0, valorNoturno: 0, valorDobra: 0,
      regra: regra.modelo, avisos,
    }

    if (ponto?.ausencia) {
      dia.situacao = ponto.ausencia as ApuracaoDoDia['situacao']
      if (ponto.ausencia === 'ATESTADO' || ponto.ausencia === 'FALTA_JUSTIFICADA') dia.virtuaisMin = jornadaMin
      diasCalculados.push(dia)
      continue
    }
    if (!ponto || !ponto.entrada) {
      diasCalculados.push(dia)
      continue
    }

    const { trechos, foraDeOrdem: trechoForaDeOrdem } = trechosDoDia(ponto)
    let foraDeOrdem = trechoForaDeOrdem
    const ms = trechos.reduce((s, [a, b]) => s + (b.getTime() - a.getTime()), 0)
    dia.trabalhadosMin = Math.floor(ms / MIN)
    dia.situacao = ponto.dobra ? 'DOBRA' : 'TRABALHADO'
    if (ponto.saidaIntervalo && ponto.voltaIntervalo) {
      const intervalo = duracaoMs(ponto.saidaIntervalo, ponto.voltaIntervalo)
      if (intervalo === null) foraDeOrdem = true
      else dia.intervaloMin = Math.floor(intervalo / MIN)
    }

    // Avisos (D18): só registram, nunca impedem
    if (foraDeOrdem) {
      avisos.push({ tipo: 'BATIDA_FORA_DE_ORDEM', texto: 'Uma batida está antes da anterior (erro de digitação?): o trecho ficou fora da conta até ser corrigido.' })
    }
    if (!ponto.saida && !(ponto.entradaExtra && ponto.saidaExtra)) {
      avisos.push({ tipo: 'BATIDA_INCOMPLETA', texto: 'Entrada sem saída: as horas do dia ficaram incompletas.' })
    }
    if (dia.trabalhadosMin > 600) {
      avisos.push({ tipo: 'DIA_ACIMA_10H', texto: `${fmtHoras(dia.trabalhadosMin)} no dia: passa de 10 horas, o limite com 2 horas extras (CLT, art. 59).` })
    }
    if (dia.trabalhadosMin > 360 && (dia.intervaloMin === null || dia.intervaloMin < 60)) {
      avisos.push({
        tipo: 'INTERVALO_MENOR_1H',
        texto: dia.intervaloMin === null
          ? 'Mais de 6 horas sem intervalo marcado (a CLT pede 1 hora; a convenção pode permitir menos ou a pré-assinalação).'
          : `Intervalo de ${dia.intervaloMin} min em jornada de mais de 6 horas (a CLT pede 1 hora; a convenção pode permitir menos).`,
      })
    }
    if (ultimaSaida && trechos.length > 0) {
      const descanso = (trechos[0][0].getTime() - ultimaSaida.getTime()) / MIN
      if (descanso >= 0 && descanso < 660) {
        avisos.push({ tipo: 'MENOS_DE_11H_ENTRE_JORNADAS', texto: `${fmtHoras(Math.round(descanso))} de descanso desde a saída anterior (a CLT pede 11 horas, art. 66).` })
      }
    }
    if (trechos.length > 0) ultimaSaida = trechos[trechos.length - 1][1]

    // Noturno: sempre contado (é fato); o valor só se a regra liga
    dia.noturnosMin = trechos.reduce((s, [a, b]) => s + minutosNoturnos(a, b), 0)
    dia.noturnosPagosMin = regra.horaNoturnaReduzida ? Math.round((dia.noturnosMin * 60) / 52.5) : dia.noturnosMin

    if (ponto.dobra) {
      // Dobra: o dia vale o combinado e fica fora da hora extra (D17)
      dia.valorDobra = Number(ponto.valorDobra ?? 0)
    } else {
      const excedente = dia.trabalhadosMin - jornadaMin
      const extraDoDia = excedente > regra.toleranciaMin ? excedente : 0
      const especialDiaTodo = (feriado && regra.feriado === 'DIA_TODO_100') || (domingo && !feriado && regra.domingo === 'DIA_TODO_100')
      const especialExcedente = (feriado && regra.feriado === 'EXCEDENTE_100') || (domingo && !feriado && regra.domingo === 'EXCEDENTE_100')

      if (especialDiaTodo) {
        dia.extraEspecialMin = dia.trabalhadosMin
      } else if (especialExcedente) {
        dia.extraEspecialMin = extraDoDia
      } else if (extraDoDia > 0) {
        const corte = regra.segundaFaixaAPartirMin
        if (corte !== null && regra.multiplicadorSegundaFaixa !== null && extraDoDia > corte) {
          dia.extraMin = corte
          dia.extraSegundaFaixaMin = extraDoDia - corte
        } else {
          dia.extraMin = extraDoDia
        }
      }
    }
    diasCalculados.push(dia)
  }

  // Semana: o que passar da jornada da semana, sem contar de novo o que já foi extra no dia nem o feriado pago inteiro
  for (let i = 0; i < diasCalculados.length; i += 7) {
    const semana = diasCalculados.slice(i, i + 7)
    const domingoDaSemana = semana[semana.length - 1]
    if (!domingoDaSemana || diaDaSemana(domingoDaSemana.data) !== 0) continue // semana que fecha no mês seguinte
    const regra = regraDoDia(regras, domingoDaSemana.data)
    if (!regra.contarSemana) continue
    let normais = 0
    for (const d of semana) {
      if (d.situacao !== 'TRABALHADO') continue
      const paga100Inteiro = (d.feriado && regra.feriado === 'DIA_TODO_100') || (d.domingo && !d.feriado && regra.domingo === 'DIA_TODO_100')
      if (paga100Inteiro) continue
      normais += d.trabalhadosMin - d.extraMin - d.extraSegundaFaixaMin - d.extraEspecialMin
    }
    const excesso = normais - regra.jornadaSemanalMin
    if (excesso > 0) domingoDaSemana.extraSemanaMin = excesso
  }

  // Valores, só para os dias do período da tela
  const visiveis = diasCalculados.filter((d) => d.data >= inicio && d.data <= fim)
  const totais: TotaisDoPeriodo = {
    trabalhadosMin: 0, virtuaisMin: 0, diasTrabalhados: 0, dobras: 0, atestados: 0, faltasJustificadas: 0, faltasInjustificadas: 0,
    extraMin: 0, extraSegundaFaixaMin: 0, extraEspecialMin: 0, extraSemanaMin: 0, noturnosMin: 0, noturnosPagosMin: 0,
    valorExtra: 0, valorExtraNormal: 0, valorExtraSegundaFaixa: 0, valorExtraEspecial: 0, valorNoturno: 0, valorDobras: 0,
    avisos: { DIA_ACIMA_10H: 0, INTERVALO_MENOR_1H: 0, MENOS_DE_11H_ENTRE_JORNADAS: 0, BATIDA_INCOMPLETA: 0, BATIDA_FORA_DE_ORDEM: 0 },
  }
  let somaNormal = new Decimal(0)
  let somaSegunda = new Decimal(0)
  let somaEspecial = new Decimal(0)
  let somaNoturno = new Decimal(0)
  let somaDobras = new Decimal(0)

  for (const d of visiveis) {
    const regra = regraDoDia(regras, d.data)
    const hora = valorDaHora(funcionario, regra)
    const combinado = Number(funcionario.valorHoraExtra ?? 0)
    // Hora extra comum: o valor combinado do funcionário (D15) ou a hora × o adicional da regra
    const horaExtra = combinado > 0 ? new Decimal(combinado) : hora.times(regra.multiplicadorExtra)
    const proporcao = (m: number) => (combinado > 0 ? horaExtra.times(m).div(regra.multiplicadorExtra) : hora.times(m))
    const pagaExtra = funcionario.tipo !== 'DAILY' || regra.diaristaRecebeExtra

    const vNormal = pagaExtra ? horaExtra.times(d.extraMin + d.extraSemanaMin).div(60) : new Decimal(0)
    const vSegunda = pagaExtra && regra.multiplicadorSegundaFaixa !== null
      ? proporcao(regra.multiplicadorSegundaFaixa).times(d.extraSegundaFaixaMin).div(60)
      : new Decimal(0)
    const vEspecial = pagaExtra ? proporcao(regra.multiplicadorEspecial).times(d.extraEspecialMin).div(60) : new Decimal(0)
    const vNoturno = regra.noturnoLigado ? hora.times(regra.adicionalNoturno).times(d.noturnosPagosMin).div(60) : new Decimal(0)

    d.valorExtra = vNormal.plus(vSegunda).plus(vEspecial).toDecimalPlaces(2).toNumber()
    d.valorNoturno = vNoturno.toDecimalPlaces(2).toNumber()
    // As somas ficam em Decimal até o fim, para os centavos não escaparem
    somaNormal = somaNormal.plus(vNormal)
    somaSegunda = somaSegunda.plus(vSegunda)
    somaEspecial = somaEspecial.plus(vEspecial)
    somaNoturno = somaNoturno.plus(vNoturno)
    somaDobras = somaDobras.plus(d.valorDobra)

    totais.trabalhadosMin += d.trabalhadosMin
    totais.virtuaisMin += d.virtuaisMin
    if (d.situacao === 'TRABALHADO') totais.diasTrabalhados++
    if (d.situacao === 'DOBRA') totais.dobras++
    if (d.situacao === 'ATESTADO') totais.atestados++
    if (d.situacao === 'FALTA_JUSTIFICADA') totais.faltasJustificadas++
    if (d.situacao === 'FALTA_INJUSTIFICADA') totais.faltasInjustificadas++
    totais.extraMin += d.extraMin
    totais.extraSegundaFaixaMin += d.extraSegundaFaixaMin
    totais.extraEspecialMin += d.extraEspecialMin
    totais.extraSemanaMin += d.extraSemanaMin
    totais.noturnosMin += d.noturnosMin
    totais.noturnosPagosMin += d.noturnosPagosMin
    for (const a of d.avisos) totais.avisos[a.tipo]++
  }

  totais.valorExtraNormal = somaNormal.toDecimalPlaces(2).toNumber()
  totais.valorExtraSegundaFaixa = somaSegunda.toDecimalPlaces(2).toNumber()
  totais.valorExtraEspecial = somaEspecial.toDecimalPlaces(2).toNumber()
  totais.valorExtra = somaNormal.plus(somaSegunda).plus(somaEspecial).toDecimalPlaces(2).toNumber()
  totais.valorNoturno = somaNoturno.toDecimalPlaces(2).toNumber()
  totais.valorDobras = somaDobras.toDecimalPlaces(2).toNumber()

  const regraFinal = regraDoDia(regras, fim)
  const horaFinal = valorDaHora(funcionario, regraFinal)
  const combinadoFinal = Number(funcionario.valorHoraExtra ?? 0)
  return {
    dias: visiveis,
    totais,
    valorHora: horaFinal.toDecimalPlaces(2).toNumber(),
    valorHoraExtra: (combinadoFinal > 0 ? new Decimal(combinadoFinal) : horaFinal.times(regraFinal.multiplicadorExtra)).toDecimalPlaces(2).toNumber(),
    regra: regraFinal,
  }
}
