// Rotas da conta única do ponto e da regra de hora extra da loja (08/10/2026, ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md).

import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { prisma } from '../../../../lib/prisma'
import { DiaDePonto } from '../../ponto/apuracao'
import { MODELOS } from '../../ponto/modelos'
import { abaixoDaLei, REGRA_CLT, RegraDaLoja, regraDoBanco, regraDoDia, regraParaBanco } from '../../ponto/regra'
import { apurarFuncionario, carregarRegras, resumoDaLoja } from '../../ponto/servico'

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD')

const hojeEmBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/** A regra que vale hoje, o histórico, os modelos e o que fica abaixo da lei (só sugestão, D18) */
export async function obterRegra(_request: FastifyRequest, reply: FastifyReply) {
  const linhas = await prisma.hrRuleHistory.findMany({ orderBy: { valid_from: 'desc' } })
  const regras = linhas.map(regraDoBanco)
  const atual = regraDoDia(regras, hojeEmBrasilia())
  return reply.send({
    atual,
    // A loja ainda não escolheu a regra dela: sem nenhuma linha (CLT por padrão) ou só a conta antiga
    confirmada: regras.some((r) => r.modelo !== 'LEGADO'),
    historico: regras,
    padrao: REGRA_CLT,
    modelos: MODELOS,
    abaixoDaLei: abaixoDaLei(atual),
  })
}

const regraSchema = z.object({
  vigenteDesde: dataIso.optional(),
  modelo: z.enum(['CLT', 'SP_BARES_RESTAURANTES', 'LITORAL_NORTE', 'PERSONALIZADO']),
  divisor: z.number().int().min(1).max(400),
  multiplicadorExtra: z.number().min(1).max(5),
  segundaFaixaAPartirMin: z.number().int().min(1).max(720).nullable(),
  multiplicadorSegundaFaixa: z.number().min(1).max(5).nullable(),
  multiplicadorEspecial: z.number().min(1).max(5),
  jornadaDiariaMin: z.number().int().min(60).max(1440),
  jornadaSemanalMin: z.number().int().min(60).max(10080),
  contarSemana: z.boolean(),
  toleranciaMin: z.number().int().min(0).max(120),
  domingo: z.enum(['EXCEDENTE_100', 'NORMAL', 'DIA_TODO_100']),
  feriado: z.enum(['DIA_TODO_100', 'EXCEDENTE_100']),
  noturnoLigado: z.boolean(),
  adicionalNoturno: z.number().min(0).max(2),
  horaNoturnaReduzida: z.boolean(),
  diariaMin: z.number().int().min(60).max(1440),
  diaristaRecebeExtra: z.boolean(),
  observacao: z.string().max(500).nullable().optional(),
})

/** Grava uma versão nova da regra, valendo a partir da data escolhida (o passado não muda) */
export async function salvarRegra(request: FastifyRequest, reply: FastifyReply) {
  const parsed = regraSchema.safeParse(request.body)
  if (!parsed.success) return reply.status(400).send({ message: 'Confira os campos da regra.', issues: parsed.error.format() })
  const r = parsed.data
  if ((r.segundaFaixaAPartirMin === null) !== (r.multiplicadorSegundaFaixa === null)) {
    return reply.status(400).send({ message: 'A 2ª faixa precisa da hora em que começa e do percentual (ou nenhum dos dois).' })
  }
  const regra: RegraDaLoja = {
    ...r,
    id: null,
    vigenteDesde: r.vigenteDesde ?? hojeEmBrasilia(),
    observacao: r.observacao ?? null,
  }
  // Mesma data de vigência: a nova substitui a anterior daquele dia (corrigir um erro de digitação não cria duas regras)
  const dados = regraParaBanco(regra)
  const existente = await prisma.hrRuleHistory.findFirst({ where: { valid_from: dados.valid_from } })
  const linha = existente
    ? await prisma.hrRuleHistory.update({ where: { id: existente.id }, data: dados })
    : await prisma.hrRuleHistory.create({ data: dados })
  const salva = regraDoBanco(linha)
  return reply.status(201).send({ regra: salva, abaixoDaLei: abaixoDaLei(salva) })
}

const horario = z.string().datetime({ offset: true }).nullable().optional()
const diaEditadoSchema = z.object({
  data: dataIso,
  entrada: horario,
  saidaIntervalo: horario,
  voltaIntervalo: horario,
  saida: horario,
  entradaExtra: horario,
  saidaExtra: horario,
  dobra: z.boolean().optional(),
  valorDobra: z.number().nullable().optional(),
  ausencia: z.string().nullable().optional(),
})

const paraDia = (d: z.infer<typeof diaEditadoSchema>): DiaDePonto => {
  const h = (s?: string | null) => (s ? new Date(s) : null)
  return {
    data: d.data,
    entrada: h(d.entrada),
    saidaIntervalo: h(d.saidaIntervalo),
    voltaIntervalo: h(d.voltaIntervalo),
    saida: h(d.saida),
    entradaExtra: h(d.entradaExtra),
    saidaExtra: h(d.saidaExtra),
    dobra: d.dobra ?? false,
    valorDobra: d.valorDobra ?? null,
    ausencia: d.ausencia ?? null,
  }
}

/** A conta do espelho de um funcionário (com os dias ainda não salvos, se vierem) */
export async function apurar(request: FastifyRequest, reply: FastifyReply) {
  const parsed = z.object({
    employee_id: z.string().uuid(),
    inicio: dataIso,
    fim: dataIso,
    dias: z.array(diaEditadoSchema).max(62).optional(),
  }).safeParse(request.body)
  if (!parsed.success) return reply.status(400).send({ message: 'Parâmetros inválidos.', issues: parsed.error.format() })
  const { employee_id, inicio, fim, dias } = parsed.data
  if (fim < inicio) return reply.status(400).send({ message: 'O fim vem antes do início.' })
  const r = await apurarFuncionario(employee_id, inicio, fim, dias?.map(paraDia))
  if (!r) return reply.status(404).send({ message: 'Funcionário não encontrado.' })
  return reply.send(r.resultado)
}

/** Resumo do mês da loja, com a mesma conta do espelho */
export async function resumo(request: FastifyRequest, reply: FastifyReply) {
  const parsed = z.object({ inicio: dataIso, fim: dataIso }).safeParse(request.query)
  if (!parsed.success) return reply.status(400).send({ message: 'Parâmetros inválidos.', issues: parsed.error.format() })
  const { inicio, fim } = parsed.data
  if (fim < inicio) return reply.status(400).send({ message: 'O fim vem antes do início.' })
  const [linhas, regras] = await Promise.all([resumoDaLoja(inicio, fim), carregarRegras()])
  return reply.send({
    linhas: linhas.map((l) => ({ employee: l.employee, totais: l.resultado.totais, valorHora: l.resultado.valorHora, valorHoraExtra: l.resultado.valorHoraExtra })),
    regra: regraDoDia(regras, fim),
  })
}
