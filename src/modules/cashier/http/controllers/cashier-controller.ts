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
    const userId = request.user?.sub
    let userRole = 'ADMIN'
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        })
        if (user) {
            userRole = user.role
        }
    }

    const whereCondition = userRole === 'CASHIER' ? { user_id: userId } : {}

    const sessions = await prisma.cashierSession.findMany({
        where: whereCondition,
        orderBy: { opened_at: 'desc' },
        include: { entries: true, sales: { include: { items: true } } }
    })

    const userIds = Array.from(new Set(sessions.map(s => s.user_id)))
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.name]))

    const sessionsWithUser = sessions.map(s => ({
        ...s,
        operator_name: userMap.get(s.user_id) || 'Operador'
    }))

    return reply.status(200).send(sessionsWithUser)
}

export async function getSessionDetails(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    const session = await prisma.cashierSession.findUnique({
        where: { id },
        include: {
            entries: {
                include: {
                    client: { select: { id: true, name: true } },
                    employee: { select: { id: true, name: true } }
                }
            },
            sales: { include: { items: true } }
        }
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

function normalizeString(str: string) {
    if (!str) return ''
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
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
        is_checked: z.boolean().default(false),
        type: z.string().optional(),
        identification: z.string().optional(),
        client_id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid().nullable().optional(),
    })
    const data = entrySchema.parse(request.body)
    const session = await prisma.cashierSession.findUnique({ where: { id: data.session_id } })
    if (!session || session.status !== 'OPEN') {
        return reply.status(400).send({ message: 'Caixa fechado ou não encontrado.' })
    }

    const entryType = data.type || (data.is_withdrawal ? 'WITHDRAWAL' : data.is_addition ? 'ADDITION' : data.is_tip ? 'TIP' : 'SALE')

    const entry = await prisma.cashierEntry.create({
        data: {
            cashier_session_id: data.session_id,
            origin: data.origin,
            bank: data.bank,
            payment_method: data.payment_method,
            amount: data.amount,
            is_withdrawal: data.is_withdrawal || entryType === 'WITHDRAWAL',
            is_addition: data.is_addition || entryType === 'ADDITION',
            is_tip: data.is_tip || entryType === 'TIP',
            is_checked: data.is_checked || false,
            type: entryType,
            identification: data.identification,
            client_id: data.client_id || null,
            employee_id: data.employee_id || null,
        }
    })
    return reply.status(201).send(entry)
}

export async function deleteCashierEntry(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    await prisma.cashierEntry.delete({ where: { id } })
    return reply.status(204).send()
}

export async function updateCashierEntry(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    const updateSchema = z.object({
        amount: z.number().optional(),
        payment_method: z.string().optional(),
        bank: z.string().optional(),
        origin: z.string().optional(),
        identification: z.string().optional(),
        is_checked: z.boolean().optional(),
        is_withdrawal: z.boolean().optional(),
        is_addition: z.boolean().optional(),
        is_tip: z.boolean().optional(),
        type: z.string().optional(),
        client_id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid().nullable().optional(),
    })
    const data = updateSchema.parse(request.body)
    const entry = await prisma.cashierEntry.update({
        where: { id },
        data,
    })
    return reply.status(200).send(entry)
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
    try {
        const auditSchema = z.object({ session_id: z.string().uuid() })
        const { session_id } = auditSchema.parse(request.body)

        const session = await prisma.cashierSession.findUnique({
            where: { id: session_id },
            include: { entries: true }
        })

        if (!session) {
            return reply.status(400).send({ message: 'Sessão não encontrada.' })
        }

        const user = await prisma.user.findUnique({ where: { id: session.user_id } })
        const operatorName = user ? user.name : 'Operador'
        const dateFormatted = new Date(session.opened_at).toLocaleDateString('pt-BR')

        // Limpa transações e vales anteriores criados para essa sessão para evitar duplicações ao re-auditar
        await prisma.transaction.deleteMany({ where: { cashier_session_id: session.id } })
        await prisma.payrollEntry.deleteMany({ where: { description: { contains: `Caixa ${session.id}` } } })

        let totalVendasEletronicas = 0
        const padraoCasa = ['funcionário', 'funcionario', 'pró-labore', 'pro-labore', 'cortesia', 'permuta', 'a prazo']

        for (const entry of session.entries) {
            const amount = Number(entry.amount || 0)
            const method = (entry.payment_method || '').trim()
            const bank = (entry.bank || '').toUpperCase().trim()
            const normMethod = normalizeString(method)
            const normIdent = normalizeString(entry.identification || '')

            // Sangria (Retirada de Dinheiro Físico para Depósito)
            if (entry.is_withdrawal) {
                await prisma.transaction.create({
                    data: {
                        operation: 'expense',
                        amount,
                        description: `Sangria Caixa ${session.period} ${operatorName} ${dateFormatted}`,
                        cashier_session_id: session.id,
                        confirmed: true,
                        payment_method: 'DINHEIRO'
                    }
                })
                continue
            }

            // Lançamento de Vale / Consumação para Funcionário (Integrado com PayrollEntry do RH)
            if (entry.employee_id || normIdent.includes('funcionario') || normMethod.includes('funcionario')) {
                let employeeId = entry.employee_id
                if (!employeeId && entry.identification) {
                    const emp = await prisma.employee.findFirst({
                        where: { name: { contains: entry.identification, mode: 'insensitive' } }
                    })
                    if (emp) employeeId = emp.id
                }

                if (employeeId) {
                    await prisma.payrollEntry.create({
                        data: {
                            employee_id: employeeId,
                            amount: amount,
                            type: 'VALE',
                            description: `Consumo/Vale Caixa ${session.period} - ${entry.identification || 'Funcionário'} (Caixa ${session.id})`,
                            referenceDate: new Date(session.opened_at),
                            status: 'PENDING'
                        }
                    })
                }
                continue
            }

            // Lançamento de Pendência no Contas a Receber para Cliente (Permuta, A Prazo)
            const isClientePrazo = Boolean(entry.client_id) || normMethod.includes('a prazo') || normMethod.includes('permuta')
            if (isClientePrazo) {
                let clientId = entry.client_id
                if (!clientId && entry.identification) {
                    const cli = await prisma.client.findFirst({
                        where: { name: { contains: entry.identification, mode: 'insensitive' } }
                    })
                    if (cli) clientId = cli.id
                }

                await prisma.transaction.create({
                    data: {
                        operation: 'income',
                        amount,
                        description: `A Prazo Caixa - ${entry.identification || 'Cliente'}`,
                        cashier_session_id: session.id,
                        confirmed: false, // PENDENTE DE RECEBIMENTO
                        supplier_id: clientId || undefined
                    }
                })
                continue
            }

            // Se for Dinheiro ou Evasão de Estoque (Cortesia, Pró-labore), ignora na transação eletrônica
            if (normMethod === 'dinheiro' || bank === 'CAIXA') continue
            if (bank === 'CONTA DA CASA' || padraoCasa.some(p => normMethod.includes(p))) continue

            // Se for venda eletrônica / cartão / pix / voucher / a prazo
            totalVendasEletronicas += amount
        }

        // Se houve vendas eletrônicas, cria a ÚNICA transação consolidada de entrada no financeiro
        if (totalVendasEletronicas > 0) {
            const defaultAccount = await prisma.account.findFirst()

            await prisma.transaction.create({
                data: {
                    operation: 'income',
                    amount: totalVendasEletronicas,
                    description: `Vendas Caixa ${session.period} ${operatorName} ${dateFormatted}`,
                    cashier_session_id: session.id,
                    confirmed: true,
                    payment_method: 'CAIXA',
                    account_id: defaultAccount ? defaultAccount.id : undefined
                }
            })
        }

        // Mudar status para CONFERIDO
        const updatedSession = await prisma.cashierSession.update({
            where: { id: session.id },
            data: { status: 'CONFERIDO' }
        })

        return reply.status(200).send({ message: 'Caixa auditado e consolidado financeiramente.', session: updatedSession })
    } catch (error: any) {
        console.error('[auditCashierSession Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao auditar caixa.' })
    }
}

export async function getMonthlyCashAudit(request: FastifyRequest, reply: FastifyReply) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const sessions = await prisma.cashierSession.findMany({
        where: {
            opened_at: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        orderBy: { opened_at: 'asc' },
        include: { entries: true }
    })

    const userIds = Array.from(new Set(sessions.map(s => s.user_id)))
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.name]))

    const auditItems = sessions.map((s) => {
        const abertura = s.initial_balance || 0
        let vendasDinheiro = 0
        let sangrias = 0

        for (const entry of s.entries) {
            const amt = Number(entry.amount || 0)
            const method = (entry.payment_method || '').trim()
            const bank = (entry.bank || '').toUpperCase().trim()

            if (entry.is_withdrawal) {
                sangrias += amt
            } else if (method.toLowerCase() === 'dinheiro' || bank === 'CAIXA') {
                vendasDinheiro += amt
            }
        }

        const saldoFisicoFinal = abertura + vendasDinheiro - sangrias

        return {
            id: s.id,
            opened_at: s.opened_at,
            closed_at: s.closed_at,
            period: s.period,
            status: s.status,
            operator_name: userMap.get(s.user_id) || 'Operador',
            abertura,
            vendasDinheiro,
            sangrias,
            saldoFisicoFinal,
            proximaAbertura: 0,
            divergencia: 0,
            statusComparacao: 'OK'
        }
    })

    // Validação comparativa com a Abertura do Próximo Caixa
    for (let i = 0; i < auditItems.length - 1; i++) {
        const current = auditItems[i]
        const next = auditItems[i + 1]
        current.proximaAbertura = next.abertura
        current.divergencia = next.abertura - current.saldoFisicoFinal
        if (Math.abs(current.divergencia) > 0.05) {
            current.statusComparacao = 'DIVERGENTE'
        } else {
            current.statusComparacao = 'BATENDO'
        }
    }

    // Totais acumulados do mês
    const totalAberturaInicial = auditItems.length > 0 ? auditItems[0].abertura : 0
    const totalVendasDinheiroMes = auditItems.reduce((acc, item) => acc + item.vendasDinheiro, 0)
    const totalSangriasMes = auditItems.reduce((acc, item) => acc + item.sangrias, 0)
    const saldoFisicoAtualMes = auditItems.length > 0 ? auditItems[auditItems.length - 1].saldoFisicoFinal : 0

    return reply.status(200).send({
        sessions: auditItems,
        summary: {
            totalAberturaInicial,
            totalVendasDinheiroMes,
            totalSangriasMes,
            saldoFisicoAtualMes,
            totalCaixasMes: auditItems.length
        }
    })
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
    const machines = await prisma.pOSMachine.findMany({
        where: { active: true },
        include: { rates: true }
    });
    return reply.status(200).send(machines);
}

export async function getPOSMachines(request: FastifyRequest, reply: FastifyReply) {
    const machines = await prisma.pOSMachine.findMany({
        orderBy: { name: 'asc' },
        include: { rates: true }
    });
    return reply.status(200).send(machines);
}

export async function createPOSMachine(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        name: z.string().min(1),
        account_id: z.string().optional().nullable(),
        rates: z.array(z.object({
            payment_category: z.string(),
            installments: z.number().default(1),
            tax_percentage: z.number().default(0)
        })).optional()
    })
    const data = bodySchema.parse(request.body)
    const machine = await prisma.pOSMachine.create({
        data: {
            name: data.name,
            account_id: data.account_id || null,
            rates: data.rates && data.rates.length > 0 ? {
                create: data.rates.map(r => ({
                    payment_category: r.payment_category,
                    installments: r.installments,
                    tax_percentage: r.tax_percentage
                }))
            } : undefined
        },
        include: { rates: true }
    })
    return reply.status(201).send(machine)
}

export async function updatePOSMachine(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const bodySchema = z.object({
        name: z.string().optional(),
        account_id: z.string().optional().nullable(),
        active: z.boolean().optional(),
        rates: z.array(z.object({
            payment_category: z.string(),
            installments: z.number().default(1),
            tax_percentage: z.number().default(0)
        })).optional()
    })
    const { id } = paramsSchema.parse(request.params)
    const data = bodySchema.parse(request.body)

    if (data.rates !== undefined) {
        await prisma.pOSMachineRate.deleteMany({ where: { pos_machine_id: id } })
        if (data.rates.length > 0) {
            await prisma.pOSMachineRate.createMany({
                data: data.rates.map(r => ({
                    pos_machine_id: id,
                    payment_category: r.payment_category,
                    installments: r.installments,
                    tax_percentage: r.tax_percentage
                }))
            })
        }
    }

    const machine = await prisma.pOSMachine.update({
        where: { id },
        data: {
            name: data.name,
            account_id: data.account_id !== undefined ? data.account_id : undefined,
            active: data.active !== undefined ? data.active : undefined
        },
        include: { rates: true }
    })
    return reply.status(200).send(machine)
}

export async function deletePOSMachine(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    await prisma.pOSMachine.delete({ where: { id } })
    return reply.status(204).send()
}

export async function getPaymentIdentifiers(request: FastifyRequest, reply: FastifyReply) {
    const identifiers = await prisma.paymentIdentifier.findMany({
        orderBy: { name: 'asc' },
        include: { paymentMethod: true }
    });
    return reply.status(200).send(identifiers);
}

export async function createPaymentIdentifier(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        name: z.string().min(1),
        payment_method_id: z.string().optional().nullable(),
        is_correntista_debt: z.boolean().default(false),
        is_stock_evasion: z.boolean().default(false),
    })
    const data = bodySchema.parse(request.body)

    const existing = await prisma.paymentIdentifier.findUnique({
        where: { name: data.name }
    })
    if (existing) {
        return reply.status(400).send({ message: 'Já existe um identificador cadastrado com esse nome.' })
    }

    const identifier = await prisma.paymentIdentifier.create({
        data: {
            name: data.name,
            payment_method_id: data.payment_method_id || null,
            is_correntista_debt: data.is_correntista_debt,
            is_stock_evasion: data.is_stock_evasion
        },
        include: { paymentMethod: true }
    })
    return reply.status(201).send(identifier)
}

export async function updatePaymentIdentifier(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const bodySchema = z.object({
        name: z.string().optional(),
        payment_method_id: z.string().optional().nullable(),
        is_correntista_debt: z.boolean().optional(),
        is_stock_evasion: z.boolean().optional(),
        active: z.boolean().optional()
    })
    const { id } = paramsSchema.parse(request.params)
    const data = bodySchema.parse(request.body)

    if (data.name) {
        const existing = await prisma.paymentIdentifier.findUnique({
            where: { name: data.name }
        })
        if (existing && existing.id !== id) {
            return reply.status(400).send({ message: 'Já existe um identificador cadastrado com esse nome.' })
        }
    }

    const identifier = await prisma.paymentIdentifier.update({
        where: { id },
        data: {
            name: data.name,
            payment_method_id: data.payment_method_id !== undefined ? data.payment_method_id : undefined,
            is_correntista_debt: data.is_correntista_debt,
            is_stock_evasion: data.is_stock_evasion,
            active: data.active
        },
        include: { paymentMethod: true }
    })
    return reply.status(200).send(identifier)
}

export async function deletePaymentIdentifier(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    await prisma.paymentIdentifier.delete({ where: { id } })
    return reply.status(204).send()
}

export async function getCashierUsers(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'CASHIER'] }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        },
        orderBy: { name: 'asc' }
    })
    return reply.status(200).send({ users })
}

export async function getCashierEmployees(request: FastifyRequest, reply: FastifyReply) {
    const employees = await prisma.employee.findMany({
        select: {
            id: true,
            name: true,
            role: true
        },
        orderBy: { name: 'asc' }
    })
    return reply.status(200).send({ employees })
}
