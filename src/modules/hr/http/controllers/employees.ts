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
    // 1. Validation: Salary required if Registered OR (NOT Daily)
    if (data.isRegistered || data.registrationType !== 'DAILY') {
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
    const data = employeeBodySchema.parse(request.body)

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
    const data = employeeBodySchema.parse(request.body)
    console.log('Dados recebidos para atualização:', data)

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
    const employees = await prisma.employee.findMany({
        orderBy: {
            name: "asc",
        },
    })

    return reply.status(200).send(employees)
}
