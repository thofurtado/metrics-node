import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../../../../lib/prisma"

// Shared schema for create/update validation logic
const employeeBodySchema = z.object({
    name: z.string(),
    role: z.string(),
    registrationType: z.enum(["REGISTERED", "UNREGISTERED", "DAILY"]).default("REGISTERED"),
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
}).superRefine((data, ctx) => {
    // 1. Validation: Salary required if NOT Daily
    if (data.registrationType !== 'DAILY') {
        if (data.salary === null || data.salary === undefined || data.salary <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Salário Base é obrigatório para funcionários registrados ou mensalistas.",
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

    // Run parallel queries
    const [count, employees] = await Promise.all([
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
