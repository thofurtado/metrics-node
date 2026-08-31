import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CARD_PAYMENT_METHODS = [
    'CREDITO', 'DEBITO', 'PIX', 'VOUCHER', 
    'crédito', 'débito', 'pix', 'voucher',
    'Crédito', 'Débito', 'Pix', 'Voucher',
    'Cartão de Crédito', 'Cartão de Débito',
    'cartão de crédito', 'cartão de débito',
    'Cartão de crédito', 'Cartão de débito',
    'PAGBANK', 'STONE', 'PagBank', 'Stone', 'Safra', 'SAFRA'
]

const TERM_PAYMENT_METHODS = [
    'A PRAZO', 'PERMUTA', 'a prazo', 'permuta', 'A Prazo', 'Permuta',
    'FIADO', 'fiado', 'Fiado', 'CONTA DA CASA', 'FUNCIONARIO', 'funcionario', 'Funcionário'
]

export async function listSettlements(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('20'),
        sortBy: z.string().optional().default('data_vencimento'),
        sortDir: z.string().optional().default('desc'),
        month: z.string().optional(),
        year: z.string().optional(),
        type: z.enum(['automatic', 'term', 'all']).optional().default('automatic'),
    })
    const { page, limit, sortBy, sortDir, month, year, type } = querySchema.parse(request.query)
    const take = parseInt(limit, 10)
    const skip = (parseInt(page, 10) - 1) * take

    const whereClause: any = {
        confirmed: true,
        operation: 'income',
    }

    if (type === 'automatic') {
        whereClause.payment_method = { in: CARD_PAYMENT_METHODS }
        whereClause.cashier_session_id = { not: null }
    } else if (type === 'term') {
        whereClause.OR = [
            { payment_method: { in: TERM_PAYMENT_METHODS } },
            { description: { contains: 'Acerto' } },
            { description: { contains: 'A Prazo' } },
            { description: { contains: 'Permuta' } }
        ]
    }

    if (month && year) {
        const m = parseInt(month, 10)
        const y = parseInt(year, 10)
        const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0)
        const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999)
        whereClause.data_vencimento = {
            gte: startOfMonth,
            lte: endOfMonth
        }
    }

    const [transactions, total, aggregate] = await Promise.all([
        prisma.transaction.findMany({
            where: whereClause,
            orderBy: { [sortBy]: sortDir === 'asc' ? 'asc' : 'desc' },
            include: { accounts: true },
            skip,
            take,
        }),
        prisma.transaction.count({ where: whereClause }),
        prisma.transaction.aggregate({
            where: whereClause,
            _sum: {
                amount: true,
                totalValue: true,
            }
        })
    ])

    const totalGross = Number(aggregate._sum.amount || 0)
    const totalNet = Number(aggregate._sum.totalValue || totalGross)
    const totalFees = Math.max(0, totalGross - totalNet)

    return reply.status(200).send({
        data: transactions,
        meta: {
            total,
            page: parseInt(page, 10),
            limit: take,
            totalPages: Math.ceil(total / take)
        },
        summary: {
            totalGross,
            totalNet,
            totalFees,
            count: total
        }
    })
}

export async function revertSettlement(request: FastifyRequest, reply: FastifyReply) {
    const revertSchema = z.object({ id: z.string().uuid() })
    const { id } = revertSchema.parse(request.params)

    const transaction = await prisma.transaction.findUnique({
        where: { id }
    })

    if (!transaction) {
        return reply.status(404).send({ message: 'Transação não encontrada.' })
    }

    try {
        await prisma.transaction.update({
            where: { id },
            data: { confirmed: false }
        })

        return reply.status(200).send({ message: 'Liquidação revertida com sucesso.' })
    } catch (error: any) {
        console.error('Error reverting settlement:', error)
        return reply.status(500).send({ message: 'Erro ao reverter liquidação.', details: error.message })
    }
}

export async function getPendingSettlements(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('100'),
        sortBy: z.string().optional().default('data_vencimento'),
        sortDir: z.string().optional().default('asc'),
        month: z.string().optional(),
        year: z.string().optional(),
        type: z.enum(['automatic', 'term', 'all']).optional().default('all'),
    })
    const { page, limit, sortBy, sortDir, month, year, type } = querySchema.parse(request.query)
    const take = parseInt(limit, 10)
    const skip = (parseInt(page, 10) - 1) * take

    const whereClause: any = {
        confirmed: false,
        operation: 'income',
    }

    if (type === 'automatic') {
        whereClause.payment_method = { in: CARD_PAYMENT_METHODS }
    } else if (type === 'term') {
        whereClause.OR = [
            { payment_method: { in: TERM_PAYMENT_METHODS } },
            { description: { contains: 'A Prazo' } },
            { description: { contains: 'Permuta' } }
        ]
    }

    // Filtro de mês: se passado, busca pendências emitidas no mês OU com vencimento no mês
    if (month && year) {
        const m = parseInt(month, 10)
        const y = parseInt(year, 10)
        const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0)
        const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999)
        
        if (type === 'automatic') {
            whereClause.OR = [
                { data_emissao: { gte: startOfMonth, lte: endOfMonth } },
                { data_vencimento: { gte: startOfMonth, lte: endOfMonth } }
            ]
        } else {
            whereClause.AND = [
                {
                    OR: [
                        { data_emissao: { gte: startOfMonth, lte: endOfMonth } },
                        { data_vencimento: { gte: startOfMonth, lte: endOfMonth } }
                    ]
                }
            ]
        }
    }

    const [transactions, total, aggregate] = await Promise.all([
        prisma.transaction.findMany({
            where: whereClause,
            orderBy: { [sortBy]: sortDir === 'asc' ? 'asc' : 'desc' },
            include: { accounts: true },
            skip,
            take,
        }),
        prisma.transaction.count({ where: whereClause }),
        prisma.transaction.aggregate({
            where: whereClause,
            _sum: {
                amount: true,
                totalValue: true,
            }
        })
    ])

    // Se for busca de a prazo (term) ou geral (all), inclui também vales de funcionários do RH
    let employeeVales: any[] = []
    if (type === 'term' || type === 'all') {
        const valeWhere: any = {
            type: 'VALE',
            status: 'PENDING',
        }
        if (month && year) {
            const m = parseInt(month, 10)
            const y = parseInt(year, 10)
            const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0)
            const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999)
            valeWhere.referenceDate = {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }

        const rawVales = await prisma.payrollEntry.findMany({
            where: valeWhere,
            include: { employee: true },
            orderBy: { referenceDate: 'desc' }
        })

        employeeVales = rawVales.map(v => ({
            id: `payroll-${v.id}`,
            amount: Number(v.amount),
            totalValue: Number(v.amount),
            description: v.description,
            data_vencimento: v.referenceDate,
            data_emissao: v.referenceDate,
            payment_method: 'FUNCIONARIO',
            interest: 0,
            isEmployeeVale: true,
            employeeName: v.employee?.name || 'Funcionário',
            employeeId: v.employee_id,
        }))
    }

    const totalGross = Number(aggregate._sum.amount || 0) + (type === 'term' || type === 'all' ? employeeVales.reduce((acc, v) => acc + v.amount, 0) : 0)
    const totalNet = Number(aggregate._sum.totalValue || totalGross) + (type === 'term' || type === 'all' ? employeeVales.reduce((acc, v) => acc + v.amount, 0) : 0)
    const totalFees = Math.max(0, totalGross - totalNet)

    let finalData = transactions
    if (type === 'term') {
        finalData = [...transactions, ...employeeVales]
    }

    return reply.status(200).send({
        data: finalData,
        meta: {
            total: total + (type === 'term' ? employeeVales.length : 0),
            page: parseInt(page, 10),
            limit: take,
            totalPages: Math.ceil((total + (type === 'term' ? employeeVales.length : 0)) / take)
        },
        summary: {
            totalGross,
            totalNet,
            totalFees,
            count: total + (type === 'term' ? employeeVales.length : 0)
        }
    })
}
