import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../../../../lib/prisma"

export async function listTimeClocks(request: FastifyRequest, reply: FastifyReply) {
    const listQuerySchema = z.object({
        employee_id: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.string().optional().default("1").transform(Number),
        per_page: z.string().optional().default("20").transform(Number),
    })

    const { employee_id, startDate, endDate, page, per_page } = listQuerySchema.parse(request.query)

    const whereClause: any = {}

    if (employee_id) {
        whereClause.employee_id = employee_id
    }

    if (startDate && endDate) {
        whereClause.date = {
            gte: new Date(startDate),
            lte: new Date(endDate),
        }
    } else if (startDate) {
        whereClause.date = {
            gte: new Date(startDate)
        }
    }

    const [timeClocks, count] = await Promise.all([
        prisma.timeClock.findMany({
            where: whereClause,
            include: {
                employee: {
                    select: {
                        name: true,
                        role: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            },
            skip: (page - 1) * per_page,
            take: per_page
        }),
        prisma.timeClock.count({ where: whereClause })
    ])

    return reply.status(200).send({
        timeClocks,
        meta: {
            page,
            per_page,
            total: count,
            last_page: Math.ceil(count / per_page)
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
        isExtraDay: z.boolean().optional(),
        negotiatedValue: z.number().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().optional(),
    })

    const { id } = paramsSchema.parse(request.params)
    const data = bodySchema.parse(request.body)

    const timeClock = await prisma.timeClock.update({
        where: { id },
        data
    })

    return reply.status(200).send(timeClock)
}

export async function upsertTimeClock(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        employee_id: z.string().uuid(),
        date: z.string(), // ISO String or YYYY-MM-DD
        clockIn: z.string().nullable().optional(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
        clockOut: z.string().nullable().optional(),
        isExtraDay: z.boolean().doc("Check for Extra Day").optional(),
        negotiatedValue: z.number().nullable().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().nullable().optional(),
    })

    const { employee_id, date, ...data } = bodySchema.parse(request.body)

    // Normalize date to start of day for search
    const searchDate = new Date(date)
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999))

    const existing = await prisma.timeClock.findFirst({
        where: {
            employee_id,
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    })

    const transformDate = (s: string | null | undefined) => s ? new Date(s) : s === null ? null : undefined

    const payload = {
        clockIn: transformDate(data.clockIn),
        breakStart: transformDate(data.breakStart),
        breakEnd: transformDate(data.breakEnd),
        clockOut: transformDate(data.clockOut),
        isExtraDay: data.isExtraDay,
        negotiatedValue: data.negotiatedValue,
        isVerified: data.isVerified,
        notes: data.notes
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
                date: new Date(date),
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
        isExtraDay: z.boolean().optional(),
        negotiatedValue: z.number().nullable().optional(),
        isVerified: z.boolean().optional(),
        notes: z.string().nullable().optional(),
    })

    const bodySchema = z.object({
        entries: z.array(itemSchema)
    })

    const { entries } = bodySchema.parse(request.body)

    const transformDate = (s: string | null | undefined) => s ? new Date(s) : s === null ? null : undefined

    await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            const { employee_id, date, ...data } = entry

            // Normalize date
            const searchDate = new Date(date)
            // Fix: ensure correct date parsing if simple YYYY-MM-DD string is passed without timezone
            // Using full ISO string recommended from frontend

            const startOfDay = new Date(searchDate)
            startOfDay.setHours(0, 0, 0, 0)

            const endOfDay = new Date(searchDate)
            endOfDay.setHours(23, 59, 59, 999)

            const existing = await tx.timeClock.findFirst({
                where: {
                    employee_id,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                }
            })

            const payload = {
                clockIn: transformDate(data.clockIn),
                breakStart: transformDate(data.breakStart),
                breakEnd: transformDate(data.breakEnd),
                clockOut: transformDate(data.clockOut),
                isExtraDay: data.isExtraDay,
                negotiatedValue: data.negotiatedValue,
                isVerified: true,
                notes: data.notes || "Edição em lote"
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
                        date: new Date(date),
                        ...payload
                    }
                })
            }
        }
    })

    return reply.status(200).send({ success: true, count: entries.length })
}
