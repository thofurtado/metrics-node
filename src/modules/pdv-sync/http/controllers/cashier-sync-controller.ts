import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * Determina o período do dia caso não seja informado
 */
function getPeriodFromDate(date: Date): string {
    const hour = date.getHours()
    if (hour >= 6 && hour < 11) return 'Manhã'
    if (hour >= 11 && hour < 15) return 'Almoço'
    if (hour >= 15 && hour < 18) return 'Tarde'
    if (hour >= 18 && hour < 23) return 'Jantar'
    return 'Noite'
}

/**
 * Sincroniza Abertura de Caixa vinda do PDV.
 * Garante que a CashierSession na nuvem tenha o mesmo UUID do caixa local.
 */
export async function postCashierOpenSync(request: FastifyRequest, reply: FastifyReply) {
    const openSchema = z.object({
        uuid: z.string().uuid(),
        terminal_id: z.string().optional().default('Terminal-1'),
        initial_balance: z.number().default(0),
        period: z.string().optional(),
        opened_at: z.string().optional(),
        operator_id: z.string().uuid().optional().nullable(),
    })

    const data = openSchema.parse(request.body)
    const openedAt = data.opened_at ? new Date(data.opened_at) : new Date()
    const period = data.period || getPeriodFromDate(openedAt)

    // Se operator_id foi informado e existe, usamos ele; caso contrário, usamos o primeiro ADMIN
    let targetUserId = data.operator_id
    if (targetUserId) {
        const userExists = await prisma.user.findUnique({ where: { id: targetUserId } })
        if (!userExists) targetUserId = undefined
    }

    if (!targetUserId) {
        const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true }
        })
        if (adminUser) {
            targetUserId = adminUser.id
        } else {
            const anyUser = await prisma.user.findFirst({ select: { id: true } })
            targetUserId = anyUser?.id
        }
    }

    if (!targetUserId) {
        return reply.status(400).send({ message: 'Nenhum usuário disponível para vincular ao caixa.' })
    }

    const session = await prisma.cashierSession.upsert({
        where: { id: data.uuid },
        update: {
            initial_balance: data.initial_balance,
            status: 'OPEN',
            period: period,
            opened_at: openedAt,
        },
        create: {
            id: data.uuid,
            user_id: targetUserId,
            initial_balance: data.initial_balance,
            status: 'OPEN',
            period: period,
            opened_at: openedAt,
        }
    })

    // Vincula pedidos órfãos delivery criados a partir da data de abertura
    try {
        const dayStart = new Date(openedAt)
        dayStart.setHours(0, 0, 0, 0)

        await prisma.pedido.updateMany({
            where: {
                origem: 'Delivery',
                caixa_id: null,
                data_abertura: { gte: dayStart, lte: openedAt }
            },
            data: {
                caixa_id: session.id
            }
        })
    } catch (e) {
        console.error('[CashierSync] Erro ao vincular pedidos órfãos:', e)
    }

    return reply.status(200).send({
        message: 'Caixa sincronizado com sucesso',
        session
    })
}

/**
 * Sincroniza Lote de Movimentações de Caixa (Sangrias, Suprimentos, Despesas Operacionais, Vales)
 */
export async function postCashierMovementsSync(request: FastifyRequest, reply: FastifyReply) {
    const movementsSchema = z.array(z.object({
        uuid: z.string().uuid(),
        cashier_session_id: z.string().uuid(),
        tipo: z.string(), // "Sangria", "Suprimento", "SaidaOperacional", "Vale", etc.
        valor: z.number(),
        data_transacao: z.string().optional(),
        observacao: z.string().optional().nullable(),
        payment_method: z.string().optional().default('Dinheiro'),
    }))

    const movements = movementsSchema.parse(request.body)
    if (movements.length === 0) {
        return reply.status(200).send({ count: 0, message: 'Nenhuma movimentação para sincronizar' })
    }

    let processedCount = 0

    await prisma.$transaction(async (tx) => {
        for (const mov of movements) {
            // Verifica se a sessão de caixa existe
            const session = await tx.cashierSession.findUnique({
                where: { id: mov.cashier_session_id }
            })

            if (!session) {
                console.warn(`[CashierSync] Movimentação ignorada: sessão ${mov.cashier_session_id} não encontrada.`)
                continue
            }

            const tipoLower = (mov.tipo || '').toLowerCase()
            const isSangria = tipoLower.includes('sangria')
            const isSuprimento = tipoLower.includes('suprimento') || tipoLower.includes('sobracaixa')
            const isDespesa = tipoLower.includes('saidaoperacional') || tipoLower.includes('vale') || tipoLower.includes('despesa')

            let entryType = 'WITHDRAWAL'
            let isWithdrawal = true
            let isAddition = false

            if (isSuprimento) {
                entryType = 'ADDITION'
                isWithdrawal = false
                isAddition = true
            } else if (isDespesa) {
                entryType = 'EXPENSE'
                isWithdrawal = true
                isAddition = false
            } else if (isSangria) {
                entryType = 'WITHDRAWAL'
                isWithdrawal = true
                isAddition = false
            }

            const ident = mov.observacao ? `${mov.tipo}: ${mov.observacao}` : mov.tipo
            const createdAt = mov.data_transacao ? new Date(mov.data_transacao) : new Date()

            await tx.cashierEntry.upsert({
                where: { id: mov.uuid },
                update: {
                    amount: mov.valor,
                    payment_method: mov.payment_method || 'Dinheiro',
                    is_withdrawal: isWithdrawal,
                    is_addition: isAddition,
                    type: entryType,
                    identification: ident,
                },
                create: {
                    id: mov.uuid,
                    cashier_session_id: mov.cashier_session_id,
                    amount: mov.valor,
                    payment_method: mov.payment_method || 'Dinheiro',
                    is_withdrawal: isWithdrawal,
                    is_addition: isAddition,
                    is_checked: false,
                    type: entryType,
                    identification: ident,
                    created_at: createdAt,
                }
            })

            processedCount++
        }
    })

    return reply.status(200).send({
        count: processedCount,
        message: `${processedCount} movimentações sincronizadas com sucesso.`
    })
}

/**
 * Sincroniza Fechamento de Caixa vindo do PDV.
 * Atualiza status para PENDING (aguardando conferência cega do gestor no CloudHub)
 * e registra closed_at.
 */
export async function postCashierCloseSync(request: FastifyRequest, reply: FastifyReply) {
    const closeSchema = z.object({
        uuid: z.string().uuid(),
        closed_at: z.string().optional(),
        final_balance: z.number().optional().nullable(),
        status: z.string().optional().default('PENDING')
    })

    const data = closeSchema.parse(request.body)
    const closedAt = data.closed_at ? new Date(data.closed_at) : new Date()

    const session = await prisma.cashierSession.findUnique({
        where: { id: data.uuid }
    })

    if (!session) {
        return reply.status(404).send({ message: 'Sessão de caixa não encontrada.' })
    }

    const updated = await prisma.cashierSession.update({
        where: { id: data.uuid },
        data: {
            status: data.status || 'PENDING',
            closed_at: closedAt
        }
    })

    return reply.status(200).send({
        message: 'Fechamento de caixa sincronizado com sucesso',
        session: updated
    })
}
