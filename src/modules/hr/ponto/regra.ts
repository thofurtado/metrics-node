// Regra de hora extra da loja (ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md, 07/10/2026).
// O sistema é sugestivo (D18): a loja escolhe os números; os modelos só sugerem, com o que a lei ou a convenção pede.

export type ModoDomingo = 'EXCEDENTE_100' | 'NORMAL' | 'DIA_TODO_100'
export type ModoFeriado = 'DIA_TODO_100' | 'EXCEDENTE_100'
export type ModeloDeRegra = 'CLT' | 'SP_BARES_RESTAURANTES' | 'LITORAL_NORTE' | 'PERSONALIZADO' | 'LEGADO'

export interface RegraDaLoja {
  id: string | null
  /** yyyy-mm-dd: a regra vale para os dias a partir desta data (nunca recalcula o passado) */
  vigenteDesde: string
  modelo: ModeloDeRegra
  /** Divisor do salário mensal para achar a hora (220 = 44h semanais) */
  divisor: number
  /** 1.5 = 50% */
  multiplicadorExtra: number
  /** Minutos de extra no dia a partir dos quais vale a 2ª faixa (ex.: 120 = depois da 2ª hora extra). null = sem 2ª faixa */
  segundaFaixaAPartirMin: number | null
  multiplicadorSegundaFaixa: number | null
  /** Domingo e feriado: 2.0 = 100% */
  multiplicadorEspecial: number
  jornadaDiariaMin: number
  jornadaSemanalMin: number
  /** Também conta extra acima da jornada da semana (sem contar a mesma hora duas vezes) */
  contarSemana: boolean
  /** Passou da tolerância no dia, conta tudo (CLT, art. 58, § 1º) */
  toleranciaMin: number
  domingo: ModoDomingo
  feriado: ModoFeriado
  noturnoLigado: boolean
  /** 0.20 = 20% sobre a hora normal */
  adicionalNoturno: number
  /** Hora noturna de 52min30s (CLT, art. 73, § 1º) */
  horaNoturnaReduzida: boolean
  /** Horas padrão da diária, em minutos (D14) */
  diariaMin: number
  /** Diarista recebe hora extra pela regra (a loja pode desligar; as horas continuam aparecendo, D18) */
  diaristaRecebeExtra: boolean
  observacao: string | null
}

/** O mínimo da lei. Padrão da loja que não configurou nada (D2). */
export const REGRA_CLT: RegraDaLoja = {
  id: null,
  vigenteDesde: '1900-01-01',
  modelo: 'CLT',
  divisor: 220,
  multiplicadorExtra: 1.5,
  segundaFaixaAPartirMin: null,
  multiplicadorSegundaFaixa: null,
  multiplicadorEspecial: 2.0,
  jornadaDiariaMin: 480,
  jornadaSemanalMin: 2640,
  contarSemana: true,
  toleranciaMin: 10,
  domingo: 'EXCEDENTE_100',
  feriado: 'DIA_TODO_100',
  noturnoLigado: true,
  adicionalNoturno: 0.2,
  horaNoturnaReduzida: true,
  diariaMin: 480,
  diaristaRecebeExtra: true,
  observacao: null,
}

/**
 * A conta que o espelho da web fazia até a versão 2.6.22 (7h20 por dia, tolerância de 10 min, 60%, domingo com o excedente a
 * 100%, feriado o dia todo a 100%, sem noturno, sem conta pela semana, diarista sem valor de hora extra). Vira a primeira regra
 * das lojas que já usavam o ponto, para os meses passados continuarem com os números que a loja já viu.
 */
export const REGRA_LEGADO: RegraDaLoja = {
  ...REGRA_CLT,
  vigenteDesde: '2000-01-01',
  modelo: 'LEGADO',
  multiplicadorExtra: 1.6,
  jornadaDiariaMin: 440,
  contarSemana: false,
  noturnoLigado: false,
  diariaMin: 440,
  diaristaRecebeExtra: false,
}

const num = (v: unknown, padrao: number): number => {
  if (v === null || v === undefined) return padrao
  const n = Number(v)
  return Number.isFinite(n) ? n : padrao
}

const data = (d: Date | string): string => (typeof d === 'string' ? d.substring(0, 10) : d.toISOString().substring(0, 10))

/** Linha da tabela hr_rule_histories (Prisma) para a regra usada na conta. */
export function regraDoBanco(linha: Record<string, any>): RegraDaLoja {
  return {
    id: linha.id ?? null,
    vigenteDesde: data(linha.valid_from),
    modelo: (linha.model_key as ModeloDeRegra) ?? 'PERSONALIZADO',
    divisor: num(linha.he_divisor, 220),
    multiplicadorExtra: num(linha.he_multiplier_standard, 1.6),
    segundaFaixaAPartirMin: linha.second_tier_after_minutes ?? null,
    multiplicadorSegundaFaixa: linha.he_multiplier_second_tier == null ? null : num(linha.he_multiplier_second_tier, 0),
    multiplicadorEspecial: num(linha.he_multiplier_special, 2),
    jornadaDiariaMin: num(linha.daily_workload_minutes, 500),
    jornadaSemanalMin: num(linha.weekly_workload_minutes, 2640),
    contarSemana: linha.count_weekly ?? false,
    toleranciaMin: num(linha.tolerance_minutes, 10),
    domingo: (linha.sunday_mode as ModoDomingo) ?? 'EXCEDENTE_100',
    feriado: (linha.holiday_mode as ModoFeriado) ?? 'DIA_TODO_100',
    noturnoLigado: linha.night_enabled ?? false,
    adicionalNoturno: num(linha.night_additional, 0.2),
    horaNoturnaReduzida: linha.night_reduced_hour ?? true,
    diariaMin: num(linha.daily_rate_minutes, 480),
    diaristaRecebeExtra: linha.daily_workers_overtime ?? true,
    observacao: linha.notes ?? null,
  }
}

/** Regra para gravar (o que vai no banco). */
export function regraParaBanco(r: RegraDaLoja) {
  return {
    valid_from: new Date(`${r.vigenteDesde}T00:00:00.000Z`),
    model_key: r.modelo,
    he_divisor: r.divisor,
    he_multiplier_standard: r.multiplicadorExtra,
    second_tier_after_minutes: r.segundaFaixaAPartirMin,
    he_multiplier_second_tier: r.multiplicadorSegundaFaixa,
    he_multiplier_special: r.multiplicadorEspecial,
    daily_workload_minutes: r.jornadaDiariaMin,
    weekly_workload_minutes: r.jornadaSemanalMin,
    count_weekly: r.contarSemana,
    tolerance_minutes: r.toleranciaMin,
    sunday_mode: r.domingo,
    holiday_mode: r.feriado,
    night_enabled: r.noturnoLigado,
    night_additional: r.adicionalNoturno,
    night_reduced_hour: r.horaNoturnaReduzida,
    daily_rate_minutes: r.diariaMin,
    daily_workers_overtime: r.diaristaRecebeExtra,
    notes: r.observacao,
  }
}

/**
 * A regra que vale num dia: a mais recente com vigência até aquele dia. Sem nenhuma regra gravada, a CLT (D2).
 * `regras` pode vir em qualquer ordem.
 */
export function regraDoDia(regras: RegraDaLoja[], dia: string): RegraDaLoja {
  let escolhida: RegraDaLoja | null = null
  for (const r of regras) {
    if (r.vigenteDesde <= dia && (!escolhida || r.vigenteDesde > escolhida.vigenteDesde)) escolhida = r
  }
  return escolhida ?? REGRA_CLT
}

/**
 * Comparação com o mínimo da lei, para a tela mostrar como sugestão (D18): nunca bloqueia, só avisa.
 * Devolve os pontos em que a regra fica abaixo do que a CLT pede.
 */
export function abaixoDaLei(r: RegraDaLoja): string[] {
  const avisos: string[] = []
  if (r.multiplicadorExtra < 1.5) avisos.push('A hora extra está abaixo de 50%, o mínimo da Constituição (art. 7º, XVI) e da CLT (art. 59, § 1º).')
  if (r.multiplicadorEspecial < 2) avisos.push('Domingo e feriado trabalhados sem folga compensatória são pagos em dobro (100%).')
  if (!r.noturnoLigado) avisos.push('O adicional noturno (22h às 5h, pelo menos 20%) está desligado (CLT, art. 73).')
  else if (r.adicionalNoturno < 0.2) avisos.push('O adicional noturno está abaixo de 20%, o mínimo da CLT (art. 73).')
  if (r.noturnoLigado && !r.horaNoturnaReduzida) avisos.push('A hora noturna da CLT conta como 52 minutos e 30 segundos (art. 73, § 1º).')
  if (r.jornadaDiariaMin > 480) avisos.push('A jornada do dia passa de 8 horas, o limite da Constituição (art. 7º, XIII).')
  if (r.jornadaSemanalMin > 2640) avisos.push('A jornada da semana passa de 44 horas, o limite da Constituição (art. 7º, XIII).')
  if (r.toleranciaMin > 10) avisos.push('A tolerância passa de 10 minutos no dia (CLT, art. 58, § 1º).')
  if (!r.diaristaRecebeExtra) avisos.push('O diarista registrado também tem direito a hora extra com o adicional.')
  return avisos
}
