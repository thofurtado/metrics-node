import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function openCashierSession(request: FastifyRequest, reply: FastifyReply) {
    const openSchema = z.object({
        initial_balance: z.number().default(0),
        period: z.string().default("Almoço"),
        user_id: z.string().uuid().optional(),
        opened_at: z.string().optional(),
    })
    const data = openSchema.parse(request.body)
    
    let targetUserId = request.user.sub

    if (data.user_id && data.user_id !== request.user.sub) {
        const requester = await prisma.user.findUnique({ where: { id: request.user.sub } })
        if (requester?.role === 'ADMIN') {
            targetUserId = data.user_id
        }
    }

    const session = await prisma.cashierSession.create({
        data: {
            user_id: targetUserId,
            initial_balance: data.initial_balance,
            period: data.period,
            status: 'OPEN',
            opened_at: data.opened_at ? new Date(data.opened_at) : undefined,
        }
    })

    // Vincula apenas pedidos órfãos criados a partir da data de abertura desta sessão
    try {
        const sessionDate = session.opened_at ? new Date(session.opened_at) : new Date()
        const dayStart = new Date(sessionDate)
        dayStart.setHours(0, 0, 0, 0)

        // Só anexa pedidos sem caixa (órfãos) do mesmo dia desta sessão que não tenham caixa vinculado
        await prisma.pedido.updateMany({
            where: {
                origem: 'Delivery',
                caixa_id: null,
                data_abertura: { gte: dayStart, lte: sessionDate }
            },
            data: {
                caixa_id: session.id
            }
        })
    } catch (e) {
        console.error('[Cashier] Erro ao vincular pedidos órfãos na abertura do caixa:', e)
    }

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
        include: { entries: true, sales: { include: { items: true } } }
    })

    const periodPriority: Record<string, number> = {
        'manhã': 1,
        'almoço': 2,
        'tarde': 3,
        'jantar': 4,
        'noite': 5
    }

    sessions.sort((a, b) => {
        const dateA = new Date(a.opened_at.getFullYear(), a.opened_at.getMonth(), a.opened_at.getDate()).getTime()
        const dateB = new Date(b.opened_at.getFullYear(), b.opened_at.getMonth(), b.opened_at.getDate()).getTime()

        if (dateA !== dateB) {
            return dateB - dateA // Descending date
        }

        const pA = (a.period || '').toLowerCase()
        const pB = (b.period || '').toLowerCase()
        
        const prioA = periodPriority[pA] || 0
        const prioB = periodPriority[pB] || 0

        if (prioA !== prioB) {
            return prioB - prioA // Descending priority
        }

        return b.opened_at.getTime() - a.opened_at.getTime() // Descending exact time
    })

    const userIds = Array.from(new Set(sessions.map(s => s.user_id)))
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.name]))

    const sessionsWithUser = sessions.map(s => {
        const isFromPdv = s.entries.some(e => (e.origin || '').toLowerCase().includes('pdv')) || s.sales.length > 0
        return {
            ...s,
            operator_name: userMap.get(s.user_id) || 'Operador',
            is_pdv_integrated: isFromPdv,
            integration_channel: isFromPdv ? 'PDV Edge' : 'Retaguarda Web'
        }
    })

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
            sales: { include: { items: true } },
            transactions: {
                orderBy: { created_at: 'asc' }
            }
        }
    })
    if (!session) {
        return reply.status(404).send({ message: 'Caixa não encontrado.' })
    }
    const isFromPdv = session.entries.some(e => (e.origin || '').toLowerCase().includes('pdv')) || session.sales.length > 0
    const enrichedSession = {
        ...session,
        is_pdv_integrated: isFromPdv,
        integration_channel: isFromPdv ? 'PDV Edge' : 'Retaguarda Web'
    }
    return reply.status(200).send({ session: enrichedSession, entries: session.entries, summary: {}, transactions: session.transactions })
}

export async function deleteSession(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)
    
    // Deleta todas as transações financeiras geradas por esse caixa (resumos, liquidações, sangrias, a prazo, divergências)
    await prisma.transaction.deleteMany({ where: { cashier_session_id: id } })
    
    // Deleta os vales e consumos de funcionários gerados no RH por essa sessão de caixa
    await prisma.payrollEntry.deleteMany({ where: { description: { contains: `Caixa ${id}` } } })
    // Deleta os lançamentos e a sessão do caixa
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
        sector_id: z.string().uuid().nullable().optional(),
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
            sector_id: data.sector_id || null,
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
        sector_id: z.string().uuid().nullable().optional(),
    })
    const data = updateSchema.parse(request.body)
    const entry = await prisma.cashierEntry.update({
        where: { id },
        data,
    })
    return reply.status(200).send(entry)
}

export async function resolveCashierDivergence(request: FastifyRequest, reply: FastifyReply) {
    const resolveSchema = z.object({
        session_id: z.string().uuid(),
        amount: z.number(),
        action: z.enum(['JUSTIFY', 'DESTINATION']),
        reason: z.string(),
        account_id: z.string().optional()
    })

    const data = resolveSchema.parse(request.body)
    const { session_id, amount, action, reason, account_id } = data

    const session = await prisma.cashierSession.findUnique({
        where: { id: session_id }
    })

    if (!session) {
        return reply.status(404).send({ message: 'Sessão de caixa não encontrada.' })
    }

    const userId = request.user.sub
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ message: 'Apenas administradores podem resolver divergências.' })
    }
    
    if (action === 'DESTINATION' && amount > 0) {
        return reply.status(400).send({ message: 'Não é possível destinar sobras de caixa para contas bancárias. Utilize apenas Justificativa.' })
    }

    const isWithdrawal = amount < 0;
    const absAmount = Math.abs(amount);

    const sessionUser = await prisma.user.findUnique({ where: { id: session.user_id } })
    const operatorName = sessionUser ? sessionUser.name : 'Operador'
    const dateFormatted = new Date(session.opened_at).toLocaleDateString('pt-BR')

    let bankName = 'Caixa Central'
    if (action === 'DESTINATION' && account_id) {
        const account = await prisma.account.findUnique({ where: { id: account_id }})
        if (account) bankName = account.name
    }

    // Embed the resolver's name in the identification for frontend parsing
    const formattedReason = `${reason}|@|${user.name}`

    const entry = await prisma.cashierEntry.create({
        data: {
            cashier_session_id: session.id,
            origin: action === 'DESTINATION' && account_id ? account_id : null,
            amount: absAmount,
            payment_method: 'Dinheiro',
            bank: bankName,
            is_withdrawal: isWithdrawal,
            is_addition: !isWithdrawal,
            type: action === 'DESTINATION' ? 'SANGRIA_DESTINO' : 'AJUSTE_AUDITORIA',
            identification: formattedReason,
        }
    })

    let createdTransaction = null
    if (action === 'DESTINATION' && account_id) {
        createdTransaction = await prisma.transaction.create({
            data: {
                operation: 'transfer', // Transferência/Custódia neutra: não infla o faturamento como venda duplicada
                amount: absAmount,
                totalValue: absAmount,
                description: `Destino de Caixa ${session.period || ''} ${operatorName} ${dateFormatted} - ${reason}`,
                account_id: account_id,
                cashier_session_id: session.id,
                confirmed: true,
                payment_method: 'DINHEIRO',
                data_vencimento: session.opened_at,
                data_emissao: session.opened_at,
            }
        })

        // Atualizar saldo da conta de destino!
        await prisma.account.update({
            where: { id: account_id },
            data: { balance: { increment: absAmount } }
        })
    }

    return reply.status(200).send({ 
        message: 'Divergência resolvida com sucesso.', 
        entry,
        transaction_id: createdTransaction?.id
    })
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

/**
 * Envia o caixa para conferência: OPEN → PENDING.
 * Pode ser chamado pelo próprio operador (CASHIER) ou por um ADMIN.
 * Não realiza auditoria financeira — isso fica a cargo de auditCashierSession (ADMIN).
 */
export async function submitCashierForReview(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({ session_id: z.string().uuid() })
    const { session_id } = bodySchema.parse(request.body)

    const session = await prisma.cashierSession.findUnique({ where: { id: session_id } })
    if (!session) {
        return reply.status(404).send({ message: 'Caixa não encontrado.' })
    }
    if (session.status !== 'OPEN') {
        return reply.status(400).send({ message: 'Apenas caixas abertos podem ser enviados para conferência.' })
    }

    // Se não for ADMIN, só permite enviar o próprio caixa
    const userId = request.user.sub
    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (requester?.role !== 'ADMIN' && session.user_id !== userId) {
        return reply.status(403).send({ message: 'Sem permissão para enviar este caixa para conferência.' })
    }

    const updated = await prisma.cashierSession.update({
        where: { id: session_id },
        data: { status: 'PENDING', closed_at: new Date() }
    })
    return reply.status(200).send(updated)
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
        // (Excluindo Destino de Caixa, pois são tratados na resolução de divergência)
        await prisma.transaction.deleteMany({ 
            where: { 
                cashier_session_id: session.id,
                description: { not: { startsWith: 'Destino de Caixa' } }
            } 
        })
        await prisma.payrollEntry.deleteMany({ where: { description: { contains: `Caixa ${session.id}` } } })
        // Localiza contas financeiras ativas com antecedência para vincular despesas e receitas
        const accounts = await prisma.account.findMany()
        const defaultAccount = accounts.find(a => !a.is_transit) || accounts[0] || null
        const centralAccount = accounts.find(a => 
            normalizeString(a.name).includes('caixa central') || 
            normalizeString(a.name) === 'central' ||
            normalizeString(a.name).includes('cofre')
        ) || defaultAccount
        let totalDespesasDinheiro = 0

        const vendasPorBanco = new Map<string, number>()
        const vendasAPrazo = new Map<string, number>()
        const padraoCasa = ['funcionário', 'funcionario', 'pró-labore', 'pro-labore', 'cortesia', 'permuta', 'a prazo', 'correntista', 'fiado', 'convenio']

        for (const entry of session.entries) {
            const amount = Number(entry.amount || 0)
            const method = (entry.payment_method || '').trim()
            const bank = (entry.bank || '').toUpperCase().trim()
            const normMethod = normalizeString(method)
            const normIdent = normalizeString(entry.identification || '')

            // Sangria de Destino / Divergência Destinada
            if (entry.type === 'SANGRIA_DESTINO') {
                // Já tratado em resolveCashierDivergence e não foi apagado
                continue
            }

            // Sangria (Retirada de Dinheiro Físico)
            if (entry.is_withdrawal) {
                const isVale = Boolean(entry.employee_id) || 
                    normIdent.includes('vale') || 
                    normIdent.includes('vt') || 
                    normIdent.includes('funcionario') || 
                    entry.type === 'WITHDRAWAL_EMPLOYEE'

                const isRecolhimentoDonoOuCofre = 
                    entry.type === 'WITHDRAWAL_OWNER' ||
                    normIdent.includes('samir') ||
                    normIdent.includes('manobra') ||
                    normIdent.includes('troco') ||
                    normIdent.includes('cofre') ||
                    normIdent.includes('recolhimento') ||
                    (normIdent === 'sangria' && !entry.sector_id) // Sangria genérica sem setor = recolhimento/cofre

                if (isVale) {
                    let employeeId = entry.employee_id
                    if (!employeeId && entry.identification) {
                        const cleanSearch = entry.identification.replace(/^(Vale|VT)\s*/i, '').trim()
                        if (cleanSearch) {
                            const emp = await prisma.employee.findFirst({
                                where: { name: { contains: cleanSearch, mode: 'insensitive' } }
                            })
                            if (emp) employeeId = emp.id
                        }
                    }

                    if (!employeeId) {
                        const firstEmp = await prisma.employee.findFirst()
                        if (firstEmp) employeeId = firstEmp.id
                    }

                    if (employeeId) {
                        await prisma.payrollEntry.create({
                            data: {
                                employee_id: employeeId,
                                amount: amount,
                                type: 'VALE',
                                description: `Vale Sangria Caixa ${session.period} - ${entry.identification || 'Funcionário'} (Caixa ${session.id})`,
                                referenceDate: new Date(session.opened_at),
                                status: 'PENDING'
                            }
                        })
                    }

                    // Gera a transação financeira de despesa vinculada ao Caixa Central
                    await prisma.transaction.create({
                        data: {
                            operation: 'expense',
                            amount,
                            totalValue: amount,
                            description: `Sangria Caixa ${session.period} ${operatorName} ${dateFormatted} - Vale: ${entry.identification || 'Funcionário'}`,
                            cashier_session_id: session.id,
                            confirmed: true,
                            payment_method: 'DINHEIRO',
                            account_id: centralAccount?.id || null,
                            data_vencimento: session.opened_at,
                            data_emissao: session.opened_at,
                        }
                    })
                    totalDespesasDinheiro += amount
                } else if (isRecolhimentoDonoOuCofre) {
                    // Recolhimento do Dono / Retirada de Troco / Depósito em Cofre:
                    // Adiantamento do Caixa Central. Não gera nova despesa contábil pois todo o dinheiro de vendas entra no Caixa Central.
                    continue
                } else {
                    // Despesa operacional real da empresa (músico, fornecedor, mercado, compras com setor)
                    await prisma.transaction.create({
                        data: {
                            operation: 'expense',
                            amount,
                            totalValue: amount,
                            description: `Sangria Caixa ${session.period} ${operatorName} ${dateFormatted}${entry.identification ? ` - ${entry.identification}` : ''}`,
                            cashier_session_id: session.id,
                            confirmed: true,
                            payment_method: 'DINHEIRO',
                            account_id: centralAccount?.id || null,
                            data_vencimento: session.opened_at,
                            data_emissao: session.opened_at,
                            sector_id: entry.sector_id || null,
                        }
                    })
                    totalDespesasDinheiro += amount
                }
                continue
            }

            // Lançamento de Vale / Consumação para Funcionário (Integrado com PayrollEntry do RH)
            if (entry.employee_id || normIdent.includes('funcionario') || normMethod.includes('funcionario')) {
                let employeeId = entry.employee_id
                if (!employeeId && entry.identification) {
                    const cleanSearch = entry.identification.replace(/^(Mesa|Balcão|Delivery)\s*/i, '').trim()
                    if (cleanSearch) {
                        const emp = await prisma.employee.findFirst({
                            where: { name: { contains: cleanSearch, mode: 'insensitive' } }
                        })
                        if (emp) employeeId = emp.id
                    }
                }

                if (!employeeId) {
                    const firstEmp = await prisma.employee.findFirst()
                    if (firstEmp) employeeId = firstEmp.id
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

            // Lançamento de Pendência no Contas a Receber para Cliente (Qualquer forma a prazo / identificador exceto funcionário)
            const isClientePrazo = Boolean(entry.client_id) || Boolean(entry.client) || normMethod.includes('a prazo') || normMethod.includes('permuta') || normMethod.includes('correntista') || (!normMethod.includes('funcionario') && !normIdent.includes('funcionario') && Boolean(entry.identification) && !['dinheiro', 'pix', 'debito', 'credito', 'voucher'].some(m => normMethod.includes(m)))
            if (isClientePrazo) {
                const clientName = entry.client?.name || entry.identification || 'Cliente'
                const methodType = method.toUpperCase().trim() || 'A PRAZO'
                const key = `${methodType}|${clientName}`
                const currentTotal = vendasAPrazo.get(key) || 0
                vendasAPrazo.set(key, currentTotal + amount)
                continue
            }

            // Se for Dinheiro ou Evasão de Estoque (Cortesia, Pró-labore), ignora nas transações eletrônicas
            if (normMethod === 'dinheiro' || bank === 'CAIXA') continue
            if (bank === 'CONTA DA CASA' || padraoCasa.some(p => normMethod.includes(p))) continue

            // Acumula vendas eletrônicas por Banco/Maquininha + Tipo de Pagamento
            const bankName = bank || method.toUpperCase() || 'CAIXA'
            const key = `${bankName}|${method.toLowerCase()}`
            const currentTotal = vendasPorBanco.get(key) || 0
            vendasPorBanco.set(key, currentTotal + amount)
        }

        let summaryTotal = 0;
        for (const entry of session.entries) {
            const amount = Number(entry.amount || 0)
            if (entry.is_withdrawal) {
                summaryTotal -= amount;
            } else {
                summaryTotal += amount;
            }
        }

        // Busca todas as maquininhas para vincular o account_id e taxas corretas
        const posMachines = await prisma.pOSMachine.findMany({ include: { rates: true } })

        // Acumula e cria a transação consolidada de Vendas em Dinheiro Físico (Reconhece o faturamento oficial)
        let totalVendasDinheiro = 0
        for (const entry of session.entries) {
            if (!entry.is_withdrawal && !entry.is_addition) {
                const normM = normalizeString(entry.payment_method || '')
                if (normM.includes('dinheiro') || (entry.bank || '').toUpperCase() === 'CAIXA') {
                    totalVendasDinheiro += Number(entry.amount || 0)
                }
            }
        }

        if (totalVendasDinheiro > 0) {
            await prisma.transaction.create({
                data: {
                    operation: 'income',
                    amount: totalVendasDinheiro,
                    totalValue: totalVendasDinheiro,
                    description: `Vendas em Dinheiro - Caixa ${session.period} ${operatorName} ${dateFormatted}`,
                    cashier_session_id: session.id,
                    confirmed: true,
                    payment_method: 'DINHEIRO',
                    account_id: centralAccount?.id || null,
                    data_vencimento: session.opened_at,
                    data_emissao: session.opened_at,
                }
            })
        }

        // Atualiza saldo contábil da conta Caixa Central com o saldo líquido em espécie
        const saldoLiquidoDinheiro = totalVendasDinheiro - totalDespesasDinheiro
        if (centralAccount && saldoLiquidoDinheiro !== 0) {
            await prisma.account.update({
                where: { id: centralAccount.id },
                data: { balance: { increment: saldoLiquidoDinheiro } }
            })
        }

        // Cria UMA transação no financeiro para CADA banco/maquininha com vendas no caixa
        for (const [key, totalAmount] of vendasPorBanco.entries()) {
            const [bankName, paymentMethodRaw] = key.split('|')
            if (totalAmount <= 0) continue

            // Localiza a conta bancária associada
            let targetAccountId: string | undefined = undefined

            // Determina a máquina e a taxa para saber os dias de liquidação
            const matchedMachine = posMachines.find(m => m.name.toUpperCase() === bankName.toUpperCase())
            let settlementDays = 0
            
            let taxPercentage = 0
            
            // Tenta achar a taxa que case com o tipo (crédito/débito)
            if (matchedMachine && matchedMachine.rates.length > 0) {
                const normPayment = normalizeString(paymentMethodRaw)
                const rate = matchedMachine.rates.find(r => normalizeString(r.payment_category).includes(normPayment))
                if (rate) {
                    settlementDays = rate.settlement_days
                    taxPercentage = rate.tax_percentage
                } else if (normPayment.includes('crédito') || normPayment.includes('credito')) {
                    settlementDays = 30
                } else if (normPayment.includes('débito') || normPayment.includes('debito')) {
                    settlementDays = 1
                }
            } else if (normalizeString(paymentMethodRaw).includes('crédito') || normalizeString(paymentMethodRaw).includes('credito')) {
                settlementDays = 30
            } else if (normalizeString(paymentMethodRaw).includes('débito') || normalizeString(paymentMethodRaw).includes('debito')) {
                settlementDays = 1
            }

            // Calcula a data de vencimento (liquidação prevista)
            const due_date = new Date(session.opened_at)
            if (settlementDays > 0) {
                due_date.setDate(due_date.getDate() + settlementDays)
            }

            // Determina a conta de destino real
            if (matchedMachine && matchedMachine.account_id) {
                targetAccountId = matchedMachine.account_id
            } else {
                const matchedAccount = accounts.find(a => a.name.toUpperCase().includes(bankName) || bankName.includes(a.name.toUpperCase()))
                if (matchedAccount) {
                    targetAccountId = matchedAccount.id
                }
            }

            if (!targetAccountId && defaultAccount) {
                targetAccountId = defaultAccount.id
            }

            const paymentDisplay = paymentMethodRaw ? paymentMethodRaw.charAt(0).toUpperCase() + paymentMethodRaw.slice(1) : ''

            // Lógica Conta Transitória com Marcador de Destino
            const transitAccount = accounts.find(a => a.is_transit)
            let finalAccountIdToUse = targetAccountId
            let finalDescription = `Caixa ${session.period} ${operatorName} ${dateFormatted} - ${bankName} ${paymentDisplay}`

            if (transitAccount && targetAccountId) {
                finalAccountIdToUse = transitAccount.id
                finalDescription += ` [DEST: ${targetAccountId}]`
            }

            // Calcula o valor líquido subtraindo a taxa
            const feeAmount = (totalAmount * taxPercentage) / 100
            const netAmount = totalAmount - feeAmount

            await prisma.transaction.create({
                data: {
                    operation: 'income',
                    amount: totalAmount, // Valor Original/Cheio (Ex: 25.90)
                    totalValue: netAmount, // Valor Líquido/Efetivo (Ex: 25.25)
                    description: finalDescription,
                    cashier_session_id: session.id,
                    confirmed: false, // Cartões/PIX entram sempre como pendentes até a liquidação
                    payment_method: paymentMethodRaw,
                    account_id: finalAccountIdToUse,
                    data_vencimento: due_date,
                    data_emissao: session.opened_at,
                    interest: taxPercentage, // Guarda a taxa para relatórios futuros
                }
            })
        }

        // Cria transações na Conta Transitória para Fiado/A Prazo agrupado por cliente
        for (const [key, totalAmount] of vendasAPrazo.entries()) {
            const [methodName, clientName] = key.split('|')
            if (totalAmount <= 0) continue

            const due_date = new Date(session.opened_at)
            due_date.setDate(due_date.getDate() + 30) // Padrão 30 dias para fiado

            const isTransit = accounts.find(a => a.is_transit);
            const accountToUse = isTransit ? isTransit.id : defaultAccount?.id;

            await prisma.transaction.create({
                data: {
                    operation: 'income',
                    amount: totalAmount,
                    totalValue: totalAmount,
                    description: `Caixa ${session.period} ${operatorName} ${dateFormatted} - ${methodName}: ${clientName}`,
                    cashier_session_id: session.id,
                    confirmed: false, // A prazo sempre entra pendente
                    payment_method: methodName,
                    account_id: accountToUse,
                    data_vencimento: due_date,
                    data_emissao: session.opened_at,
                    interest: 0,
                }
            })
        }

        // Criar transação de RESUMO para a listagem (não afeta saldos devido ao tipo)
        await prisma.transaction.create({
            data: {
                operation: 'cashier_summary',
                amount: summaryTotal > 0 ? summaryTotal : Math.abs(summaryTotal),
                description: `Fechamento de Caixa ${session.period} ${operatorName} ${dateFormatted}`,
                cashier_session_id: session.id,
                confirmed: true,
                payment_method: 'CAIXA',
                data_vencimento: session.opened_at,
                data_emissao: session.opened_at,
            }
        })

        // Mudar status para CHECKED
        const updatedSession = await prisma.cashierSession.update({
            where: { id: session.id },
            data: { status: 'CHECKED' }
        })

        return reply.status(200).send({ message: 'Caixa auditado e consolidado financeiramente.', session: updatedSession })
    } catch (error: any) {
        console.error('[auditCashierSession Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao auditar caixa.' })
    }
}

export async function revertCashierAudit(request: FastifyRequest, reply: FastifyReply) {
    try {
        const revertSchema = z.object({ session_id: z.string().uuid() })
        const { session_id } = revertSchema.parse(request.body)

        const session = await prisma.cashierSession.findUnique({
            where: { id: session_id }
        })

        if (!session) {
            return reply.status(404).send({ message: 'Sessão não encontrada.' })
        }

        if (session.status !== 'CHECKED') {
            return reply.status(400).send({ message: 'Apenas caixas conferidos podem ser revertidos.' })
        }

        // Busca todas as transações que serão deletadas para reverter saldo e apagar vínculos
        const txsToDelete = await prisma.transaction.findMany({ 
            where: { cashier_session_id: session.id } 
        })

        for (const tx of txsToDelete) {
            // Se foi confirmada em uma conta real, revertemos o saldo
            if (tx.confirmed && tx.account_id) {
                const amountToRevert = tx.totalValue || tx.amount;
                if (tx.operation === 'income') {
                    await prisma.account.update({
                        where: { id: tx.account_id },
                        data: { balance: { decrement: amountToRevert } }
                    })
                } else if (tx.operation === 'expense') {
                    await prisma.account.update({
                        where: { id: tx.account_id },
                        data: { balance: { increment: amountToRevert } }
                    })
                }
            }
        }

        const txIds = txsToDelete.map(t => t.id)
        
        // Deleta todas as transações financeiras e vales/registros do payroll associados
        await prisma.transaction.deleteMany({ where: { cashier_session_id: session.id } })
        await prisma.payrollEntry.deleteMany({ where: { description: { contains: `Caixa ${session.id}` } } })

        // Retorna o status para PENDING (Aguardando nova conferência)
        const updatedSession = await prisma.cashierSession.update({
            where: { id: session.id },
            data: { status: 'PENDING' }
        })

        return reply.status(200).send({ message: 'Conferência revertida com sucesso. As transações financeiras foram excluídas.', session: updatedSession })
    } catch (error: any) {
        console.error('[revertCashierAudit Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao reverter auditoria de caixa.' })
    }
}

export async function getMonthlyCashAudit(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        month: z.string().optional(),
        year: z.string().optional(),
    })
    const { month, year } = querySchema.parse(request.query)

    const now = new Date()
    const targetYear = year ? parseInt(year, 10) : now.getFullYear()
    const targetMonth = month ? parseInt(month, 10) - 1 : now.getMonth()

    const startOfMonth = new Date(targetYear, targetMonth, 1)
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59)

    const sessions = await prisma.cashierSession.findMany({
        where: {
            opened_at: {
                gte: startOfMonth,
            }
        },
        include: { entries: true }
    })

    const periodPriority: Record<string, number> = {
        'manhã': 1,
        'almoço': 2,
        'tarde': 3,
        'jantar': 4,
        'noite': 5
    }

    sessions.sort((a, b) => {
        // Obter apenas a data sem as horas
        const dateA = new Date(a.opened_at.getFullYear(), a.opened_at.getMonth(), a.opened_at.getDate()).getTime()
        const dateB = new Date(b.opened_at.getFullYear(), b.opened_at.getMonth(), b.opened_at.getDate()).getTime()

        if (dateA !== dateB) {
            return dateA - dateB // Ordena por data (asc)
        }

        // Se for o mesmo dia, ordena pelo turno (Almoço antes da Janta)
        const pA = (a.period || '').toLowerCase()
        const pB = (b.period || '').toLowerCase()
        
        const prioA = periodPriority[pA] || 99
        const prioB = periodPriority[pB] || 99

        if (prioA !== prioB) {
            return prioA - prioB
        }

        // Critério de desempate caso tenham o mesmo turno ou turnos não reconhecidos
        return a.opened_at.getTime() - b.opened_at.getTime()
    })

    const userIds = Array.from(new Set(sessions.map(s => s.user_id)))
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.name]))

    const sessionIds = sessions.map(s => s.id)
    const transactions = await prisma.transaction.findMany({
        where: { cashier_session_id: { in: sessionIds } },
        select: { cashier_session_id: true, description: true }
    })

    const auditItems = sessions.map((s) => {
        const abertura = s.initial_balance || 0
        let vendasDinheiro = 0
        let sangrias = 0
        let suprimentos = 0

        for (const entry of s.entries) {
            const amt = Number(entry.amount || 0)
            const method = (entry.payment_method || '').trim()
            const bank = (entry.bank || '').toUpperCase().trim()

            if (entry.is_withdrawal) {
                sangrias += amt
            } else if (entry.is_addition) {
                suprimentos += amt
            } else if (method.toLowerCase() === 'dinheiro' || bank === 'CAIXA') {
                vendasDinheiro += amt
            }
        }

        // Saldo total apurado fisicamente na gaveta antes do recolhimento ao Caixa Central
        const saldoFisicoFinal = abertura + vendasDinheiro + suprimentos - sangrias

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
            proximaAbertura: null as number | null,
            hasNextSession: false,
            variacaoTroco: 0,
            divergencia: 0,
            recolhidoCentral: 0,
            statusComparacao: 'BATENDO',
            statusMensagem: 'Troco Mantido',
            resolutionDetails: null as any
        }
    })

    // Validação comparativa do Troco com o Próximo Caixa
    for (let i = 0; i < auditItems.length - 1; i++) {
        const current = auditItems[i]
        const next = auditItems[i + 1]
        const sessionObj = sessions.find(s => s.id === current.id)
        const resolutionEntry = sessionObj?.entries?.find((e: any) => e.type === 'SANGRIA_DESTINO' || e.type === 'AJUSTE_AUDITORIA')

        current.proximaAbertura = next.abertura
        current.hasNextSession = true

        // Variação do fundo de troco entre esta abertura e a próxima
        current.variacaoTroco = Number((next.abertura - current.abertura).toFixed(2))
        current.divergencia = current.variacaoTroco

        // Valor recolhido e transferido ao Caixa Central ao fechar o caixa
        current.recolhidoCentral = current.status === 'CHECKED'
            ? Math.max(0, Number((current.saldoFisicoFinal - next.abertura).toFixed(2)))
            : 0

        let isActuallyResolved = !!resolutionEntry
        if (resolutionEntry && resolutionEntry.type === 'SANGRIA_DESTINO') {
            const destTx = transactions.find(t => t.cashier_session_id === current.id && t.description?.startsWith('Destino de Caixa'))
            if (!destTx) {
                isActuallyResolved = false
            }
        }

        if (isActuallyResolved) {
            let reason = resolutionEntry.identification || ''
            let author = 'Sistema'
            if (reason.includes('|@|')) {
                const parts = reason.split('|@|')
                reason = parts[0]
                author = parts[1] || 'Sistema'
            }

            let transactionId = null
            if (resolutionEntry.type === 'SANGRIA_DESTINO') {
                const destTx = transactions.find(t => t.cashier_session_id === current.id && t.description?.startsWith('Destino de Caixa'))
                if (destTx) transactionId = destTx.id
            }

            current.statusComparacao = 'RESOLVIDO'
            current.statusMensagem = 'Resolvido'
            current.resolutionDetails = {
                type: resolutionEntry.type,
                reason: reason,
                author: author,
                bank: resolutionEntry.bank,
                transaction_id: transactionId
            }
        } else {
            // Compara a evolução do fundo de troco
            if (Math.abs(current.variacaoTroco) <= 0.05) {
                current.statusComparacao = 'BATENDO'
                current.statusMensagem = 'Troco Mantido'
            } else if (current.variacaoTroco > 0) {
                current.statusComparacao = 'SUPRIMENTO'
                current.statusMensagem = `Suprimento (+R$ ${current.variacaoTroco.toFixed(2)})`
            } else {
                current.statusComparacao = 'SANGRIA_TROCO'
                current.statusMensagem = `Redução (-R$ ${Math.abs(current.variacaoTroco).toFixed(2)})`
            }
        }
    }

    // Filtrar apenas os itens pertencentes ao mês solicitado para o relatório
    const filteredMonthItems = auditItems.filter(item => {
        const d = new Date(item.opened_at)
        return d >= startOfMonth && d <= endOfMonth
    })

    // Totais acumulados do mês
    const totalAberturaInicial = filteredMonthItems.length > 0 ? filteredMonthItems[0].abertura : 0
    const totalVendasDinheiroMes = filteredMonthItems.reduce((acc, item) => acc + item.vendasDinheiro, 0)
    const totalSangriasMes = filteredMonthItems.reduce((acc, item) => acc + item.sangrias, 0)
    const saldoFisicoAtualMes = filteredMonthItems.length > 0 ? filteredMonthItems[filteredMonthItems.length - 1].saldoFisicoFinal : 0

    return reply.status(200).send({
        sessions: filteredMonthItems,
        summary: {
            totalAberturaInicial,
            totalVendasDinheiroMes,
            totalSangriasMes,
            saldoFisicoAtualMes,
            totalCaixasMes: filteredMonthItems.length
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
            tax_percentage: z.number().default(0),
            settlement_days: z.number().default(1)
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
                    tax_percentage: r.tax_percentage,
                    settlement_days: r.settlement_days
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
            tax_percentage: z.number().default(0),
            settlement_days: z.number().default(1)
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
                    tax_percentage: r.tax_percentage,
                    settlement_days: r.settlement_days
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
            OR: [
                { role: { in: ['ADMIN', 'CASHIER'] } },
                {
                    userModules: {
                        some: {
                            module: {
                                slug: 'cashier'
                            }
                        }
                    }
                }
            ]
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

export async function updateCashierSessionBalance(request: FastifyRequest, reply: FastifyReply) {
    const updateSchema = z.object({
        initial_balance: z.number().min(0)
    })
    
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)
    const { initial_balance } = updateSchema.parse(request.body)

    const session = await prisma.cashierSession.findUnique({
        where: { id }
    })

    if (!session) {
        return reply.status(404).send({ message: 'Sessão de caixa não encontrada.' })
    }

    if (session.status === 'CLOSED' || session.status === 'AUDITED') {
        return reply.status(400).send({ message: 'Não é possível alterar o saldo de um caixa já fechado ou auditado.' })
    }

    const updatedSession = await prisma.cashierSession.update({
        where: { id },
        data: { initial_balance }
    })

    return reply.status(200).send({ message: 'Saldo inicial atualizado com sucesso.', session: updatedSession })
}
