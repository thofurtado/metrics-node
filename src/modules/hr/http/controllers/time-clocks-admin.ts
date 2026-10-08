import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../../../../lib/prisma"
import { apurarPeriodo } from "../../ponto/apuracao"
import { diaDoBanco, carregarFeriados, carregarRegras, funcionarioDoBanco } from "../../ponto/servico"
import { regraDoDia } from "../../ponto/regra"
export async function listTimeClocks(request: FastifyRequest, reply: FastifyReply) {
    const listQuerySchema = z.object({
        employee_id: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.string().optional().default("1").transform(Number),
        per_page: z.string().optional().default("20").transform(Number),
    })

    const parsed = listQuerySchema.safeParse(request.query)

    if (!parsed.success) {
        return reply.status(400).send({ message: "Parâmetros de busca inválidos.", issues: parsed.error.format() })
    }

    const { employee_id, startDate, endDate, page, per_page } = parsed.data

    // Proteção contra skip negativo (e.g., se vier um page 0 ou vazio que vira NaN/0)
    const validPage = Math.max(1, isNaN(page) ? 1 : page)
    const validPerPage = Math.max(1, isNaN(per_page) ? 20 : per_page)

    const whereClause: any = {}

    if (employee_id) {
        whereClause.employee_id = employee_id
    }

    if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            whereClause.date = {
                gte: start,
                lte: end,
            }
        }
    } else if (startDate) {
        const start = new Date(startDate)
        if (!isNaN(start.getTime())) {
            whereClause.date = {
                gte: start
            }
        }
    }

    const [timeClocks, count] = await Promise.all([
        prisma.timeClock.findMany({
            where: whereClause,
            include: {
                employee: {
                    select: {
                        name: true,
                        role: true,
                        salary: true,
                        dailyRate: true,
                        overtimeValue: true,
                        registrationType: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            },
            skip: (validPage - 1) * validPerPage,
            take: validPerPage
        }),
        prisma.timeClock.count({ where: whereClause })
    ])

    // Conta única do ponto (08/10/2026): a mesma do espelho, do resumo do mês e do PDF (src/modules/hr/ponto/apuracao.ts).
    // Antes esta rota tinha a sua própria conta (e tratava segunda-feira como domingo).
    const datas = timeClocks.map(tc => tc.date.toISOString().substring(0, 10)).sort()
    const [regras, feriados] = datas.length > 0
        ? await Promise.all([carregarRegras(), carregarFeriados(datas[0], datas[datas.length - 1])])
        : [[], []]

    const porFuncionario = new Map<string, typeof timeClocks>()
    timeClocks.forEach(tc => {
        const lista = porFuncionario.get(tc.employee_id) ?? []
        lista.push(tc)
        porFuncionario.set(tc.employee_id, lista)
    })

    const apuracaoDoDia = new Map<string, { minutos: number; valor: number; especial: boolean; dia: any }>()
    let summary = {
        totalOvertimeMinutes60: 0,
        totalOvertimeValue60: 0,
        totalOvertimeMinutes100: 0,
        totalOvertimeValue100: 0,
    }
    porFuncionario.forEach((lista, employeeId) => {
        const datasDele = lista.map(tc => tc.date.toISOString().substring(0, 10)).sort()
        const r = apurarPeriodo({
            funcionario: funcionarioDoBanco(lista[0].employee as any),
            dias: lista.map(diaDoBanco),
            feriados,
            regras,
            inicio: datasDele[0],
            fim: datasDele[datasDele.length - 1],
        })
        r.dias.forEach(d => apuracaoDoDia.set(`${employeeId}|${d.data}`, {
            minutos: d.extraMin + d.extraSegundaFaixaMin + d.extraEspecialMin + d.extraSemanaMin,
            valor: d.valorExtra,
            especial: d.extraEspecialMin > 0,
            dia: d,
        }))
        summary.totalOvertimeMinutes60 += r.totais.extraMin + r.totais.extraSegundaFaixaMin + r.totais.extraSemanaMin
        summary.totalOvertimeValue60 += r.totais.valorExtraNormal + r.totais.valorExtraSegundaFaixa
        summary.totalOvertimeMinutes100 += r.totais.extraEspecialMin
        summary.totalOvertimeValue100 += r.totais.valorExtraEspecial
    })

    const processedTimeClocks = timeClocks.map(tc => {
        const data = tc.date.toISOString().substring(0, 10)
        const a = apuracaoDoDia.get(`${tc.employee_id}|${data}`)
        const regra = regraDoDia(regras, data)
        return {
            ...tc,
            overtimeMinutes: a?.minutos ?? 0,
            overtimeValue: a?.valor ?? 0,
            calculation_memory: a && a.minutos > 0 ? {
                divisor: regra.divisor,
                multiplier: a.especial ? regra.multiplicadorEspecial : regra.multiplicadorExtra,
                multiplier_reason: a.especial ? 'Domingo ou feriado' : 'Hora extra',
                workload_minutes: a.dia.jornadaMin,
                apuracao: a.dia,
            } : null,
        }
    })

    return reply.status(200).send({
        timeClocks: processedTimeClocks,
        summary,
        meta: {
            page: validPage,
            per_page: validPerPage,
            total: count,
            last_page: Math.ceil(count / validPerPage)
        }
    })
}

export async function updateTimeClock(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid(),
    })

    const bodySchema = z.object({
        clockIn: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        breakStart: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        breakEnd: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        clockOut: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        extraClockIn: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        extraClockOut: z.string().nullable().optional().transform(s => s ? new Date(s) : null),
        isExtraDay: z.boolean().optional(),
        negotiatedValue: z.number().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().optional(),
        absenceReason: z.string().nullable().optional(),
        isJustifiedAbsence: z.boolean().optional(),
    })

    const { id } = paramsSchema.parse(request.params)
    const data = bodySchema.parse(request.body)

    const timeClock = await prisma.timeClock.update({
        where: { id },
        data
    })

    return reply.status(200).send(timeClock)
}

/**
 * O dia da batida do jeito que a coluna DATE guarda (meia-noite UTC de "2026-10-02"). Antes a busca usava new Date(a, m, d) no
 * fuso do servidor; com o servidor no horário de Brasília (desde 23/09/2026, 2.6.76) a busca do dia 02 pegava também o dia 03:
 * o salvar gravava o 02 POR CIMA da linha do 03 (que voltava ao certo logo depois, se estava no mesmo salvar) e o dia 02 nunca era
 * criado. Caso do Marujo em 08/10/2026: "salvou e o horário sumiu". A busca agora é pelo dia exato (pessoa + dia é único).
 */
export function diaDoPonto(data: string): Date {
    const [yyyy, mm, dd] = data.substring(0, 10).split('-').map(Number)
    return new Date(Date.UTC(yyyy, mm - 1, dd))
}

export async function upsertTimeClock(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        employee_id: z.string().uuid(),
        date: z.string(), // ISO String or YYYY-MM-DD
        clockIn: z.string().nullable().optional(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
        clockOut: z.string().nullable().optional(),
        extraClockIn: z.string().nullable().optional(),
        extraClockOut: z.string().nullable().optional(),
        isExtraDay: z.boolean().describe("Check for Extra Day").optional(),
        negotiatedValue: z.number().nullable().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        absenceReason: z.string().nullable().optional(),
        isJustifiedAbsence: z.boolean().optional(),
    })

    const { employee_id, date, ...data } = bodySchema.parse(request.body)

    // O dia exato (ver diaDoPonto): nunca uma faixa de horas no fuso do servidor
    const dia = diaDoPonto(date)
    const existing = await prisma.timeClock.findUnique({
        where: { employee_id_date: { employee_id, date: dia } }
    })

    const transformDate = (s: string | null | undefined) => s ? new Date(s) : s === null ? null : undefined

    const payload = {
        clockIn: transformDate(data.clockIn),
        breakStart: transformDate(data.breakStart),
        breakEnd: transformDate(data.breakEnd),
        clockOut: transformDate(data.clockOut),
        extraClockIn: transformDate(data.extraClockIn),
        extraClockOut: transformDate(data.extraClockOut),
        isExtraDay: data.isExtraDay,
        negotiatedValue: data.negotiatedValue,
        isVerified: data.isVerified,
        notes: data.notes,
        absenceReason: data.absenceReason,
        isJustifiedAbsence: data.isJustifiedAbsence
    }

    let result
    if (existing) {
        result = await prisma.timeClock.update({
            where: { id: existing.id },
            data: payload
        })
    } else {
        result = await prisma.timeClock.create({
            data: {
                employee_id,
                date: dia,
                ...payload
            }
        })
    }

    return reply.status(200).send(result)
}

export async function bulkUpsertTimeClocks(request: FastifyRequest, reply: FastifyReply) {
    const itemSchema = z.object({
        employee_id: z.string().uuid(),
        date: z.string(),
        clockIn: z.string().nullable().optional(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
        clockOut: z.string().nullable().optional(),
        extraClockIn: z.string().nullable().optional(),
        extraClockOut: z.string().nullable().optional(),
        isExtraDay: z.boolean().optional(),
        negotiatedValue: z.number().nullable().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        absenceReason: z.string().nullable().optional(),
        isJustifiedAbsence: z.boolean().optional(),
    })

    const bodySchema = z.object({
        entries: z.array(itemSchema)
    })

    const { entries } = bodySchema.parse(request.body)

    const transformDate = (s: string | null | undefined) => s ? new Date(s) : s === null ? null : undefined

    await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            const { employee_id, date, ...data } = entry

            // O dia exato (ver diaDoPonto): com a faixa no fuso de Brasília, o dia D gravava por cima da linha do dia D+1
            const dia = diaDoPonto(date)
            const existing = await tx.timeClock.findUnique({
                where: { employee_id_date: { employee_id, date: dia } }
            })

            const payload = {
                clockIn: transformDate(data.clockIn),
                breakStart: transformDate(data.breakStart),
                breakEnd: transformDate(data.breakEnd),
                clockOut: transformDate(data.clockOut),
                extraClockIn: transformDate(data.extraClockIn),
                extraClockOut: transformDate(data.extraClockOut),
                isExtraDay: data.isExtraDay,
                negotiatedValue: data.negotiatedValue,
                isVerified: true,
                notes: data.notes || "Edição em lote",
                absenceReason: data.absenceReason,
                isJustifiedAbsence: data.isJustifiedAbsence
            }

            if (existing) {
                await tx.timeClock.update({
                    where: { id: existing.id },
                    data: payload
                })
            } else {
                await tx.timeClock.create({
                    data: {
                        employee_id,
                        date: dia,
                        ...payload
                    }
                })
            }
        }
    })

    return reply.status(200).send({ success: true, count: entries.length })
}
