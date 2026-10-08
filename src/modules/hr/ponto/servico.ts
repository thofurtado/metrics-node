// O que a conta única do ponto precisa do banco (regras, feriados, batidas) e as apurações prontas para as telas.

import { TimeClock } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { holidayService } from '../services/holiday-service'
import { apurarPeriodo, DiaDePonto, FuncionarioDaConta, ResultadoDaApuracao } from './apuracao'
import { REGRA_LEGADO, RegraDaLoja, regraDoBanco } from './regra'

const paraData = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** Segunda-feira da semana (a conta da semana precisa dos dias anteriores ao início do mês) */
export function inicioDaBusca(inicio: string): string {
  const d = new Date(`${inicio}T12:00:00.000Z`)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().substring(0, 10)
}

/** O banco ainda não tem as colunas novas da regra (erro P2022 do Prisma, "column ... does not exist") */
export function faltamColunasDaRegra(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === 'P2022' || /hr_rule_histories.*does not exist|does not exist.*hr_rule_histories/is.test(e?.message ?? '')
}

/**
 * As versões da regra da loja, da mais antiga para a mais nova. Entre a publicação do servidor e o "Sincronizar" do SaaS Admin
 * (que cria as colunas novas), a leitura falha: a conta segue com a regra antiga (a mesma do espelho até a web 2.6.22), para o
 * ponto não parar nesse intervalo.
 */
export async function carregarRegras(): Promise<RegraDaLoja[]> {
  try {
    const linhas = await prisma.hrRuleHistory.findMany({ orderBy: { valid_from: 'asc' } })
    return linhas.map(regraDoBanco)
  } catch (err) {
    if (!faltamColunasDaRegra(err)) throw err
    return [{ ...REGRA_LEGADO }]
  }
}

export async function carregarFeriados(inicio: string, fim: string): Promise<string[]> {
  // Feriados nacionais do ano entram sozinhos (BrasilAPI); se a internet falhar, a conta segue com os que já existem
  for (let ano = Number(inicio.substring(0, 4)); ano <= Number(fim.substring(0, 4)); ano++) {
    try { await holidayService.syncHolidays(ano) } catch { /* segue com os feriados gravados */ }
  }
  const feriados = await prisma.holiday.findMany({ where: { date: { gte: paraData(inicio), lte: paraData(fim) } } })
  return feriados.map((f) => f.date.toISOString().substring(0, 10))
}

export function diaDoBanco(tc: TimeClock): DiaDePonto {
  return {
    data: tc.date.toISOString().substring(0, 10),
    entrada: tc.clockIn,
    saidaIntervalo: tc.breakStart,
    voltaIntervalo: tc.breakEnd,
    saida: tc.clockOut,
    entradaExtra: tc.extraClockIn,
    saidaExtra: tc.extraClockOut,
    dobra: tc.isExtraDay,
    valorDobra: tc.negotiatedValue === null ? null : Number(tc.negotiatedValue),
    ausencia: tc.absenceReason,
  }
}

export function funcionarioDoBanco(e: { registrationType: string; salary: unknown; dailyRate: unknown; overtimeValue: unknown }): FuncionarioDaConta {
  return {
    tipo: e.registrationType,
    salario: e.salary === null || e.salary === undefined ? null : Number(e.salary),
    diaria: e.dailyRate === null || e.dailyRate === undefined ? null : Number(e.dailyRate),
    valorHoraExtra: e.overtimeValue === null || e.overtimeValue === undefined ? null : Number(e.overtimeValue),
  }
}

/**
 * Apuração de um funcionário no período. `diasEditados` (opcional) são os dias que o espelho ainda não salvou: entram no lugar
 * dos dias do banco com a mesma data, para a tela mostrar a conta enquanto a pessoa edita.
 */
export async function apurarFuncionario(employeeId: string, inicio: string, fim: string, diasEditados?: DiaDePonto[]) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return null
  const desde = inicioDaBusca(inicio)
  const [batidas, feriados, regras] = await Promise.all([
    prisma.timeClock.findMany({ where: { employee_id: employeeId, date: { gte: paraData(desde), lte: paraData(fim) } } }),
    carregarFeriados(desde, fim),
    carregarRegras(),
  ])
  const porData = new Map<string, DiaDePonto>()
  for (const tc of batidas) porData.set(tc.date.toISOString().substring(0, 10), diaDoBanco(tc))
  for (const d of diasEditados ?? []) porData.set(d.data, d)
  const resultado = apurarPeriodo({
    funcionario: funcionarioDoBanco(employee),
    dias: [...porData.values()],
    feriados,
    regras,
    inicio,
    fim,
  })
  return { employee, resultado }
}

export interface LinhaDoResumo {
  employee: { id: string; name: string; role: string; registrationType: string; isRegistered: boolean }
  resultado: ResultadoDaApuracao
}

/** Resumo do mês da loja: todos os ativos e quem bateu ponto no período, com a mesma conta do espelho */
export async function resumoDaLoja(inicio: string, fim: string): Promise<LinhaDoResumo[]> {
  const desde = inicioDaBusca(inicio)
  const [batidas, feriados, regras] = await Promise.all([
    prisma.timeClock.findMany({ where: { date: { gte: paraData(desde), lte: paraData(fim) } } }),
    carregarFeriados(desde, fim),
    carregarRegras(),
  ])
  const comBatida = new Set(batidas.filter((b) => b.date.toISOString().substring(0, 10) >= inicio).map((b) => b.employee_id))
  const funcionarios = await prisma.employee.findMany({
    where: { OR: [{ isRegistered: true }, { id: { in: [...comBatida] } }] },
    orderBy: { name: 'asc' },
  })
  const porFuncionario = new Map<string, DiaDePonto[]>()
  for (const b of batidas) {
    const lista = porFuncionario.get(b.employee_id) ?? []
    lista.push(diaDoBanco(b))
    porFuncionario.set(b.employee_id, lista)
  }
  return funcionarios.map((e) => ({
    employee: { id: e.id, name: e.name, role: e.role, registrationType: e.registrationType, isRegistered: e.isRegistered },
    resultado: apurarPeriodo({
      funcionario: funcionarioDoBanco(e),
      dias: porFuncionario.get(e.id) ?? [],
      feriados,
      regras,
      inicio,
      fim,
    }),
  }))
}
