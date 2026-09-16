import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../../../../lib/prisma"

// Shared schema for create/update validation logic
const employeeBodySchema = z.object({
    name: z.string(),
    role: z.string(),
    registrationType: z.enum(["REGISTERED", "UNREGISTERED", "DAILY", "HOURLY"]).default("REGISTERED"),
    isRegistered: z.boolean().default(true),
    admissionDate: z.string().transform((str) => new Date(str)),
    pin: z.string().length(4),
    salary: z.preprocess((val) => {
        if (val === '' || val === null) return null
        if (val === undefined) return undefined
        return Number(val)
    }, z.number().nullable().optional()),
    dailyRate: z.preprocess((val) => {
        if (val === '' || val === null) return null
        if (val === undefined) return undefined
        return Number(val)
    }, z.number().nullable().optional()),
    points: z.preprocess((val) => val === undefined ? undefined : Number(val), z.number().min(0).default(0)),
    transportAllowance: z.preprocess((val) => val === undefined ? undefined : Number(val), z.number().min(0).default(0)),
    hasCestaBasica: z.boolean().default(false),
    allow_term_sales: z.boolean().optional().default(false),
    term_credit_limit: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0
        return Number(val)
    }, z.number().min(0).optional().default(0)),
}).superRefine((data, ctx) => {
    // 1. Validation: Salary/Hourly Rate required if NOT Daily
    if (data.registrationType !== 'DAILY') {
        const isHourly = data.registrationType === 'HOURLY'
        if (data.salary === null || data.salary === undefined || data.salary <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: isHourly ? "Valor da Hora é obrigatório para horistas." : "Salário Base é obrigatório para funcionários registrados ou mensalistas.",
                path: ["salary"]
            })
        }
    }

    // 2. Validation: Daily Rate required if Daily
    if (data.registrationType === 'DAILY') {
        if (data.dailyRate === null || data.dailyRate === undefined || data.dailyRate <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Valor da Diária é obrigatório para diaristas.",
                path: ["dailyRate"]
            })
        }
    }
})

export async function createEmployee(request: FastifyRequest, reply: FastifyReply) {
    let data;
    try {
        data = employeeBodySchema.parse(request.body)
    } catch (err: any) {
        console.log('[BACKEND/createEmployee] Erro de validação (Zod):')
        console.dir(err, { depth: null })
        console.log('[BACKEND/createEmployee] Payload que falhou:', request.body)
        throw err;
    }

    // Check PIN uniqueness
    const pinExists = await prisma.employee.findFirst({
        where: { pin: data.pin }
    })

    if (pinExists) {
        return reply.status(409).send({ message: "PIN_ALREADY_EXISTS" })
    }

    const employee = await prisma.employee.create({
        data: {
            name: data.name,
            role: data.role,
            registrationType: data.registrationType,
            isRegistered: data.isRegistered,
            admissionDate: data.admissionDate,
            pin: data.pin,
            salary: data.salary ? Number(data.salary) : null,
            dailyRate: data.dailyRate ? Number(data.dailyRate) : null,
            points: Number(data.points),
            transportAllowance: Number(data.transportAllowance),
            hasCestaBasica: data.hasCestaBasica,
            allow_term_sales: Boolean(data.allow_term_sales),
            term_credit_limit: data.term_credit_limit ? Number(data.term_credit_limit) : 0,
        }
    })

    return reply.status(201).send(employee)
}

export async function updateEmployee(request: FastifyRequest, reply: FastifyReply) {
    const updateEmployeeParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = updateEmployeeParamsSchema.parse(request.params)
    let data;
    try {
        data = employeeBodySchema.parse(request.body)
    } catch (err: any) {
        console.log('[BACKEND/updateEmployee] Erro de validação (Zod):')
        console.dir(err, { depth: null })
        console.log('[BACKEND/updateEmployee] Payload que falhou:', request.body)
        throw err;
    }

    // Check PIN uniqueness (excluding current employee)
    const pinExists = await prisma.employee.findFirst({
        where: {
            pin: data.pin,
            id: { not: id }
        }
    })

    if (pinExists) {
        return reply.status(409).send({ message: "PIN_ALREADY_EXISTS" })
    }

    const employee = await prisma.employee.update({
        where: { id },
        data: {
            name: data.name,
            role: data.role,
            registrationType: data.registrationType,
            isRegistered: data.isRegistered,
            admissionDate: data.admissionDate,
            pin: data.pin,
            salary: data.salary ? Number(data.salary) : null,
            dailyRate: data.dailyRate ? Number(data.dailyRate) : null,
            points: Number(data.points),
            transportAllowance: Number(data.transportAllowance),
            hasCestaBasica: data.hasCestaBasica,
            allow_term_sales: Boolean(data.allow_term_sales),
            term_credit_limit: data.term_credit_limit ? Number(data.term_credit_limit) : 0,
        }
    })

    return reply.status(200).send(employee)
}

export async function listEmployees(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).default(1000),
        name: z.string().optional(),
        isRegistered: z.preprocess((val) => {
            if (val === 'true') return true
            if (val === 'false') return false
            return undefined
        }, z.boolean().optional())
    })

    const { page, limit, name, isRegistered } = querySchema.parse(request.query)
    const skip = (page - 1) * limit

    const where: any = {}
    if (name) {
        where.name = { contains: name, mode: 'insensitive' }
    }

    // Filter by Active/Inactive status if provided
    if (isRegistered !== undefined) {
        where.isRegistered = isRegistered
    }

    // Run parallel queries with fallback for legacy schemas
    let count = 0
    let employees: any[] = []

    try {
        const [c, emps] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany({
                where,
                take: limit,
                skip,
                orderBy: {
                    name: "asc",
                },
            })
        ])
        count = c
        employees = emps
    } catch (err: any) {
        if (err?.code === 'P2022' || err?.message?.includes('allow_term_sales')) {
            const [c, emps] = await Promise.all([
                prisma.employee.count({ where }),
                prisma.employee.findMany({
                    where,
                    take: limit,
                    skip,
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        registrationType: true,
                        isRegistered: true,
                        admissionDate: true,
                        pin: true,
                        salary: true,
                        dailyRate: true,
                        points: true,
                        transportAllowance: true,
                        hasCestaBasica: true,
                        photo_url: true,
                        created_at: true,
                        updated_at: true,
                    },
                    orderBy: {
                        name: "asc",
                    },
                })
            ])
            count = c
            employees = emps.map((e: any) => ({
                ...e,
                allow_term_sales: false,
                term_credit_limit: 0,
            }))
        } else {
            throw err
        }
    }

    // IMPORTANT: Returning object with data to match pagination standard
    return reply.status(200).send({
        data: employees,
        meta: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit)
        }
    })
}

export async function getEmployeeSummary(request: FastifyRequest, reply: FastifyReply) {
    const [total, registered, unregistered, daily] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { registrationType: 'REGISTERED' } }),
        prisma.employee.count({ where: { registrationType: 'UNREGISTERED' } }),
        prisma.employee.count({ where: { registrationType: 'DAILY' } })
    ])

    return reply.status(200).send({
        total,
        registered,
        unregistered,
        daily
    })
}

export async function syncEmployees(request: FastifyRequest, reply: FastifyReply) {
    const employees = await prisma.employee.findMany({
        where: {
            isRegistered: true
        },
        select: {
            id: true,
            name: true,
            pin: true
        }
    })

    return reply.status(200).send(employees)
}
