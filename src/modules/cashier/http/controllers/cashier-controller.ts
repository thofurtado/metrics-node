import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function openCashierSession(request: FastifyRequest, reply: FastifyReply) {
    const openSchema = z.object({
        initial_balance: z.number().default(0),
        period: z.string().default("Almoço"),
    })
    const data = openSchema.parse(request.body)
    const user_id = request.user.sub
    const activeSession = await prisma.cashierSession.findFirst({
        where: { user_id: user_id, status: 'OPEN' }
    })
    if (activeSession) {
        return reply.status(400).send({ message: 'Usuário já possui um caixa aberto.' })
    }
    const session = await prisma.cashierSession.create({
        data: {
            user_id: user_id,
            initial_balance: data.initial_balance,
            period: data.period,
            status: 'OPEN',
        }
    })
    return reply.status(201).send(session)
}

export async function getActiveSession(request: FastifyRequest, reply: FastifyReply) {
    const user_id = request.user.sub
    const session = await prisma.cashierSession.findFirst({
        where: { user_id, status: 'OPEN' },
        include: { entries: true, sales: { include: { items: true } } }
    })
    if (!session) {
        return reply.status(404).send({ message: 'Nenhum caixa aberto encontrado.' })
    }
    return reply.status(200).send(session)
}

export async function getSessions(request: FastifyRequest, reply: FastifyReply) {
    const sessions = await prisma.cashierSession.findMany({
        orderBy: { opened_at: 'desc' },
        include: { entries: true, sales: { include: { items: true } } }
    })
    return reply.status(200).send(sessions)
}

export async function getSessionDetails(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    const session = await prisma.cashierSession.findUnique({
        where: { id },
        include: { entries: true, sales: { include: { items: true } } }
    })
    if (!session) {
        return reply.status(404).send({ message: 'Caixa não encontrado.' })
    }
    return reply.status(200).send({ session, entries: session.entries, summary: {} })
}

export async function deleteSession(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    await prisma.cashierEntry.deleteMany({ where: { cashier_session_id: id } })
    await prisma.cashierSession.delete({ where: { id } })
    return reply.status(204).send()
}

export async function addCashierEntry(request: FastifyRequest, reply: FastifyReply) {
    const entrySchema = z.object({
        session_id: z.string().uuid(),
        origin: z.string().optional(),
        bank: z.string().optional(),
        payment_method: z.string(),
        amount: z.number(),
        is_withdrawal: z.boolean().default(false),
        is_addition: z.boolean().default(false),
        is_tip: z.boolean().default(false),
        identification: z.string().optional(),
        client_id: z.string().uuid().optional(),
    })
    const data = entrySchema.parse(request.body)
    const session = await prisma.cashierSession.findUnique({ where: { id: data.session_id } })
    if (!session || session.status !== 'OPEN') {
        return reply.status(400).send({ message: 'Caixa fechado ou não encontrado.' })
    }
    const entry = await prisma.cashierEntry.create({
        data: {
            cashier_session_id: data.session_id,
            origin: data.origin,
            bank: data.bank,
            payment_method: data.payment_method,
            amount: data.amount,
            is_withdrawal: data.is_withdrawal,
            is_addition: data.is_addition,
            is_tip: data.is_tip,
            identification: data.identification,
        }
    })
    return reply.status(201).send(entry)
}

export async function closeCashierSession(request: FastifyRequest, reply: FastifyReply) {
    const closeSchema = z.object({ session_id: z.string().uuid() })
    const { session_id } = closeSchema.parse(request.body)
    const session = await prisma.cashierSession.update({
        where: { id: session_id },
        data: { status: 'PENDING', closed_at: new Date() }
    })
    return reply.status(200).send(session)
}

export async function auditCashierSession(request: FastifyRequest, reply: FastifyReply) {
    const auditSchema = z.object({ session_id: z.string().uuid() })
    const { session_id } = auditSchema.parse(request.body)

    const session = await prisma.cashierSession.findUnique({
        where: { id: session_id },
        include: { entries: true, sales: true }
    })

    if (!session || session.status !== 'PENDING') {
        return reply.status(400).send({ message: 'Sessão inválida ou não está PENDENTE.' })
    }

    // PHASE 3: MOTOR FINANCEIRO
    for (const entry of session.entries) {
        let identifier = null;
        if (entry.identification) {
            identifier = await prisma.paymentIdentifier.findFirst({ where: { name: entry.identification } })
        }

        // Se for evasão de estoque (Cortesia, Pro-labore), ignorar no financeiro real, tratar apenas em relatórios.
        if (identifier?.is_stock_evasion) {
            continue; 
        }

        // Se for Fiado/Correntista (Permuta, Funcionario), gerar transação PENDENTE vinculada.
        if (identifier?.is_correntista_debt) {
            // Note: entry should have a client_id reference in a complete system. Assuming we look up or pass client_id in description for now.
            await prisma.transaction.create({
                data: {
                    operation: 'IN',
                    amount: entry.amount,
                    description: `Fiado/Dívida - ${entry.payment_method} - ${entry.identification}`,
                    cashier_session_id: session.id,
                    confirmed: false, // PENDENTE DE RECEBIMENTO
                }
            })
            continue;
        }

        // Sangria (Out) ou Suprimento (In)
        if (entry.is_withdrawal) {
            await prisma.transaction.create({
                data: {
                    operation: 'OUT',
                    amount: entry.amount,
                    description: `Sangria de Caixa`,
                    cashier_session_id: session.id,
                    confirmed: true,
                }
            })
            continue;
        }

        if (entry.is_addition) {
            await prisma.transaction.create({
                data: {
                    operation: 'IN',
                    amount: entry.amount,
                    description: `Suprimento de Caixa`,
                    cashier_session_id: session.id,
                    confirmed: true,
                }
            })
            continue;
        }

        // Receita normal (Dinheiro, Cartão, Pix)
        await prisma.transaction.create({
            data: {
                operation: 'IN',
                amount: entry.amount,
                payment_method: entry.payment_method,
                description: `Receita Caixa - ${entry.origin || 'Balcão'}`,
                cashier_session_id: session.id,
                confirmed: true,
            }
        })
    }

    // Mudar status para CONFERIDO
    const updatedSession = await prisma.cashierSession.update({
        where: { id: session.id },
        data: { status: 'CONFERIDO' }
    })

    return reply.status(200).send({ message: 'Caixa auditado e consolidado financeiramente.', session: updatedSession })
}
export async function getPaymentMethodsConfig(request: FastifyRequest, reply: FastifyReply) {
    const methods = await prisma.payment.findMany({ where: { active: true } });
    return reply.status(200).send(methods);
}

export async function getPaymentConditionsConfig(request: FastifyRequest, reply: FastifyReply) {
    const conditions = await prisma.paymentCondition.findMany({ where: { active: true } });
    return reply.status(200).send(conditions);
}
export async function getPOSMachinesConfig(request: FastifyRequest, reply: FastifyReply) {
    const machines = await prisma.pOSMachine.findMany({ where: { active: true } });
    return reply.status(200).send(machines);
}
