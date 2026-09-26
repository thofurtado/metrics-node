import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { intervaloDoDiaOperacional } from '@/lib/dia-operacional'
import {
    SESSION_CHECKED,
    SESSION_OPEN,
    SESSION_PENDING,
    SyncRejection,
    acceptsChanges,
    isPlaceholderFromClose,
    normalizeCounted,
    shouldApplyClose,
    terminalToStore,
} from '../../services/cashier-sync-rules'

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

    // Auto-gerar sequence_number do dia operacional (vira às 05:00 de Brasília; antes recomeçava à meia-noite)
    const { inicio: dayStart, fim: dayEnd } = intervaloDoDiaOperacional(openedAt)

    const countToday = await prisma.cashierSession.count({
        where: {
            opened_at: { gte: dayStart, lt: dayEnd },
            NOT: { id: data.uuid } // o próprio caixa não conta (reenvio ou correção)
        }
    })

    const sequenceNumber = countToday + 1
    const periodLabel = data.period || `Turno ${String(sequenceNumber).padStart(2, '0')}`

    // Reenviar a abertura é seguro: o caixa que já existe não é reaberto, renumerado nem tem o fundo trocado
    // (antes o reenvio forçava OPEN e recontava o turno, e o PDV reenviava sempre). Única exceção: o caixa que a regra
    // antiga criou a partir do fechamento (fundo 0, abertura = fechamento) recebe os dados verdadeiros da abertura.
    const existing = await prisma.cashierSession.findUnique({ where: { id: data.uuid } })
    if (existing) {
        if (!isPlaceholderFromClose(existing)) {
            // Caixa aberto na web e "vinculado" pelo PDV (decisão do Thomás, 25/09): passa a ter o terminal do PDV.
            const terminal = terminalToStore(existing.terminal_id, data.terminal_id)
            if (terminal !== existing.terminal_id && existing.status !== SESSION_CHECKED) {
                const vinculado = await prisma.cashierSession.update({ where: { id: data.uuid }, data: { terminal_id: terminal } })
                return reply.status(200).send({ message: 'Caixa da nuvem vinculado a este terminal', session: vinculado })
            }
            return reply.status(200).send({ message: 'Caixa já estava na nuvem', session: existing })
        }
        const repaired = await prisma.cashierSession.update({
            where: { id: data.uuid },
            data: {
                user_id: targetUserId,
                initial_balance: data.initial_balance,
                period: periodLabel,
                sequence_number: sequenceNumber,
                opened_at: openedAt,
                terminal_id: terminalToStore(existing.terminal_id, data.terminal_id),
                source: 'PDV',
            }
        })
        return reply.status(200).send({ message: 'Abertura do caixa corrigida com os dados do PDV', session: repaired })
    }

    const session = await prisma.cashierSession.create({
        data: {
            id: data.uuid,
            user_id: targetUserId,
            initial_balance: data.initial_balance,
            status: SESSION_OPEN,
            period: periodLabel,
            sequence_number: sequenceNumber,
            opened_at: openedAt,
            terminal_id: terminalToStore(null, data.terminal_id),
            source: 'PDV',
        }
    })

    return reply.status(200).send({
        message: 'Caixa sincronizado com sucesso',
        session
    })
}

/**
 * Caixas abertos na nuvem, para o PDV decidir na abertura (decisão do Thomás, 25/09): caixa aberto na web (sem
 * terminal) no mesmo dia operacional → o PDV pergunta se quer vincular; caixa de outro terminal → o PDV só avisa.
 */
export async function getOpenCashierSessions(request: FastifyRequest, reply: FastifyReply) {
    const sessions = await prisma.cashierSession.findMany({
        where: { status: SESSION_OPEN },
        orderBy: { opened_at: 'desc' },
        take: 20,
        select: { id: true, terminal_id: true, source: true, opened_at: true, initial_balance: true, period: true, user_id: true },
    })
    const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(sessions.map(s => s.user_id))] } },
        select: { id: true, name: true },
    })
    const nomes = new Map(users.map(u => [u.id, u.name]))
    return reply.status(200).send({
        sessions: sessions.map(s => ({ ...s, operator_name: nomes.get(s.user_id) ?? null })),
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
    // Ids aceitos e recusados: o PDV só marca como enviado o que estiver em "accepted"
    const accepted: string[] = []
    const ignored: { uuid: string; reason: string }[] = []

    await prisma.$transaction(async (tx) => {
        for (const mov of movements) {
            // Verifica se a sessão de caixa existe
            const session = await tx.cashierSession.findUnique({
                where: { id: mov.cashier_session_id }
            })

            if (!session) {
                console.warn(`[CashierSync] Movimentação ignorada: sessão ${mov.cashier_session_id} não encontrada.`)
                ignored.push({ uuid: mov.uuid, reason: 'SESSAO_NAO_ENCONTRADA' })
                continue
            }

            // Caixa já conferido na web não recebe movimento novo nem alteração (a conferência já lançou o financeiro).
            if (!acceptsChanges(session)) {
                const current = await tx.cashierEntry.findUnique({ where: { id: mov.uuid }, select: { amount: true } })
                if (current && Math.round(current.amount * 100) === Math.round(mov.valor * 100)) {
                    accepted.push(mov.uuid) // reenvio do que já estava lá
                } else {
                    ignored.push({ uuid: mov.uuid, reason: 'CAIXA_JA_CONFERIDO' })
                }
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
            accepted.push(mov.uuid)
        }
    })

    return reply.status(200).send({
        count: processedCount,
        accepted,
        ignored,
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
        status: z.string().optional().default('PENDING'),
        // Contado por forma de pagamento e quebra (-) ou sobra (+), vindos do fechamento do PDV
        counted: z.record(z.string(), z.any()).optional().nullable(),
        closing_difference: z.number().optional().nullable(),
    })

    const data = closeSchema.parse(request.body)
    const closedAt = data.closed_at ? new Date(data.closed_at) : new Date()

    const session = await prisma.cashierSession.findUnique({
        where: { id: data.uuid }
    })

    if (!session) {
        // Antes a nuvem criava o caixa aqui, com fundo 0, abertura = fechamento e o primeiro administrador como operador.
        // Agora recusa com motivo: o PDV manda a abertura (com os dados verdadeiros) e depois o fechamento.
        return reply.status(409).send(new SyncRejection('CAIXA_NAO_ENVIADO', data.uuid).toResponse())
    }

    // Só caixa ABERTO vai para conferência. Reenvio para caixa em conferência ou já conferido não mexe em nada
    // (antes podia tirar um caixa conferido dessa situação, e conferir de novo somava o dinheiro duas vezes).
    const counted = normalizeCounted(data.counted)
    const contado = {
        ...(counted ? { counted } : {}),
        ...(data.closing_difference !== undefined && data.closing_difference !== null
            ? { closing_difference: Math.round(data.closing_difference * 100) / 100 } : {}),
    }

    if (!shouldApplyClose(session.status)) {
        // Reenvio: só completa o contado se ainda faltava e o caixa não foi conferido
        if (session.status !== SESSION_CHECKED && session.counted === null && Object.keys(contado).length > 0) {
            const completado = await prisma.cashierSession.update({ where: { id: data.uuid }, data: contado })
            return reply.status(200).send({ message: 'Contado do fechamento registrado', session: completado })
        }
        return reply.status(200).send({ message: 'Fechamento já estava na nuvem', session })
    }

    const updated = await prisma.cashierSession.update({
        where: { id: data.uuid },
        data: {
            status: SESSION_PENDING,
            closed_at: closedAt,
            ...contado,
        }
    })

    return reply.status(200).send({
        message: 'Fechamento de caixa sincronizado e enviado para conferência com sucesso',
        session: updated
    })
}
