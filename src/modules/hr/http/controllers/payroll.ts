import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { CalculatePointRateioUseCase } from "../../use-cases/payroll/calculate-rateio"
import { GeneratePayrollBatchUseCase } from "../../use-cases/payroll/generate-batch"
import { prisma } from "../../../../lib/prisma"

export async function calculateRateio(request: FastifyRequest, reply: FastifyReply) {
    const calculateRateioBodySchema = z.object({
        totalRevenue: z.number(),
        lostPercentage: z.number(),
        month: z.coerce.number().min(1).max(12),
        year: z.coerce.number().min(2000),
        paymentDate: z.string()
    })

    const { totalRevenue, lostPercentage, month, year, paymentDate } = calculateRateioBodySchema.parse(request.body)

    const calculateRateioUseCase = new CalculatePointRateioUseCase()

    try {
        const result = await calculateRateioUseCase.execute({
            totalRevenue,
            lostPercentage,
            month,
            year,
            paymentDate
        })

        return reply.status(200).send(result)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        return reply.status(500).send({ message: "Unknown error" })
    }
}

export async function generatePayrollBatch(request: FastifyRequest, reply: FastifyReply) {
    const generateBatchBodySchema = z.object({
        type: z.enum(["SALARIO_60", "VALE", "CESTA_BASICA", "VALE_TRANSPORTE"]),
        referenceDate: z.string(),
        splitCesta: z.boolean().optional(),
        deductDebtsOnAdvance: z.boolean().optional()
    })

    const { type, referenceDate, splitCesta, deductDebtsOnAdvance } = generateBatchBodySchema.parse(request.body)

    const generatePayrollBatchUseCase = new GeneratePayrollBatchUseCase()

    try {
        const result = await generatePayrollBatchUseCase.execute({
            type: type as any,
            referenceDate,
            splitCesta,
            deductDebtsOnAdvance
        })
        return reply.status(201).send(result)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        return reply.status(500).send({ message: "Unknown error" })
    }
}

export async function getPayrollPreview(request: FastifyRequest, reply: FastifyReply) {
    // Get all PENDING payroll entries, excluding specific types managed individually
    const entries = await prisma.payrollEntry.findMany({
        where: {
            status: "PENDING",
            type: { notIn: ["ERRO", "CONSUMACAO"] } // Include VALE so Advances/Debts show up in Preview
        },
        include: {
            employee: {
                select: {
                    name: true,
                    role: true,
                    salary: true,
                    dailyRate: true,
                    transportAllowance: true
                }
            }
        },
        orderBy: {
            employee: { name: 'asc' }
        }
    })

    // Calculate totals
    const totalAmount = entries.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)

    const byType = entries.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.type] = (acc[curr.type] || 0) + Number(curr.amount)
        return acc
    }, {} as Record<string, number>)


    return reply.status(200).send({
        entries,
        summary: {
            totalAmount,
            byType
        }
    })
}

export async function getPayrollHistory(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        month: z.coerce.number().optional(),
        year: z.coerce.number().optional(),
        type: z.string().optional()
    })

    const { month, year, type } = querySchema.parse(request.query)

    let where: any = {
        status: { in: ["PAID", "PENDING"] }
    }

    if (month && year) {
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0)
        where.referenceDate = { gte: start, lte: end }
    }

    if (type) {
        where.type = type
    }

    const entries = await prisma.payrollEntry.findMany({
        where,
        include: {
            employee: {
                select: {
                    name: true,
                    role: true
                }
            }
        },
        orderBy: {
            referenceDate: 'desc'
        }
    })

    const totalAmount = entries.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)

    return reply.status(200).send({
        entries,
        summary: {
            totalAmount
        }
    })
}

export async function deletePayrollBatch(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        type: z.string(),
        referenceDate: z.string()
    })

    const { type, referenceDate } = querySchema.parse(request.query)
    const date = new Date(referenceDate)

    const { count } = await prisma.payrollEntry.deleteMany({
        where: {
            type: type as any,
            referenceDate: date,
            status: "PENDING"
        }
    })

    return reply.status(200).send({ message: "Lote excluído com sucesso", count })
}

export async function confirmPayroll(request: FastifyRequest, reply: FastifyReply) {
    // Confirm and generate Transaction
    // 1. Get all PENDING
    const entries = await prisma.payrollEntry.findMany({
        where: { status: "PENDING" }
    })

    if (entries.length === 0) {
        return reply.status(400).send({ message: "No pending payroll entries to confirm." })
    }

    const totalAmount = entries.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)

    // 2. Create Transaction (Financial Module)
    // We need an account to debit from. Let's assume the first available account or a specific one?
    // For now, let's find ANY account or require account_id in body.
    // Let's require account_id.

    const confirmBodySchema = z.object({
        account_id: z.string().uuid()
    })

    const { account_id } = confirmBodySchema.parse(request.body)

    // Transaction
    const transaction = await prisma.transaction.create({
        data: {
            account_id,
            amount: -totalAmount, // Expense
            operation: "SAIDA", // or Expense type
            description: `Payroll/Rateio Batch Confirmation - ${new Date().toLocaleDateString()}`,
            confirmed: true,
            created_at: new Date()
        }
    })

    // 3. Update Payroll Entries
    await prisma.payrollEntry.updateMany({
        where: { status: "PENDING" },
        data: {
            status: "PAID",
            transaction_id: transaction.id
        }
    })

    return reply.status(200).send({
        message: "Payroll confirmed and transaction created.",
        transactionId: transaction.id,
        totalAmount
    })
}

export async function createPayrollEntry(request: FastifyRequest, reply: FastifyReply) {
    const entrySchema = z.object({
        employee_id: z.string().uuid(),
        description: z.string(),
        amount: z.number(),
        type: z.enum(["SALARIO_60", "SALARIO_40", "PONTUACAO_10", "DIA_EXTRA", "BENEFICIO", "VALE", "ERRO", "CONSUMACAO", "OTHER"]),
        referenceDate: z.string().transform(str => new Date(str)),
        // Status defaults to PENDING in database if not sent? Or we should enforce creating as PENDING?
        // Let's allow creating directly as PENDING.
    })

    const data = entrySchema.parse(request.body)

    const entry = await prisma.payrollEntry.create({
        data: {
            ...data,
            status: "PENDING"
        }
    })

    return reply.status(201).send(entry)
}

export async function listPendingDebts(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })
    const { id } = paramsSchema.parse(request.params)

    const debts = await prisma.payrollEntry.findMany({
        where: {
            employee_id: id,
            status: "PENDING",
            type: { in: ["VALE", "ERRO", "CONSUMACAO"] }
        },
        orderBy: { created_at: 'desc' }
    })

    return reply.status(200).send(debts)
}

export async function getEmployeePayrollEntries(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })
    const { id } = paramsSchema.parse(request.params)

    const entries = await prisma.payrollEntry.findMany({
        where: {
            employee_id: id
        },
        orderBy: {
            created_at: 'desc'
        },
        include: {
            transaction: {
                select: {
                    created_at: true,
                    confirmed: true
                }
            }
        }
    })

    return reply.status(200).send(entries)
}

export async function updatePayrollEntry(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const bodySchema = z.object({
        amount: z.number().optional(),
        description: z.string().optional()
    })

    const { id } = paramsSchema.parse(request.params)
    const { amount, description } = bodySchema.parse(request.body)

    const entry = await prisma.payrollEntry.findUnique({
        where: { id }
    })

    if (!entry) {
        return reply.status(404).send({ message: "Entry not found" })
    }

    if (entry.status === "PAID") {
        return reply.status(400).send({ message: "Cannot update paid entry" })
    }

    const updated = await prisma.payrollEntry.update({
        where: { id },
        data: {
            amount: amount,
            description: description
        }
    })

    return reply.status(200).send(updated)
}
import { CalculateRateioExtrasUseCase } from "../../use-cases/payroll/calculate-extras"

export async function calculateRateioExtras(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        month: z.coerce.number().min(1).max(12),
        year: z.coerce.number().min(2000)
    })

    const { month, year } = querySchema.parse(request.query)

    const useCase = new CalculateRateioExtrasUseCase()

    try {
        const result = await useCase.execute({ month, year })
        return reply.status(200).send(result)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        return reply.status(500).send({ message: "Unknown error" })
    }
}

export async function cancelPayrollEntry(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    const entry = await prisma.payrollEntry.findUnique({
        where: { id }
    })

    if (!entry) {
        return reply.status(404).send({ message: "Lançamento não encontrado." })
    }

    if (entry.status !== "PENDING") {
        return reply.status(400).send({ message: "Apenas lançamentos pendentes podem ser cancelados." })
    }

    await prisma.payrollEntry.update({
        where: { id },
        data: { status: "CANCELED" }
    })

    return reply.status(200).send({ message: "Lançamento cancelado com sucesso." })
}
