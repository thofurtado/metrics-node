import { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    METODO_DA_PLATAFORMA,
    SETOR_TAXAS_DE_PLATAFORMA,
    intervaloDoDiaDeBrasilia,
    vencimentoDoDia,
} from '@/modules/cashier/services/plataformas'
import { setoresPorNome } from '@/modules/cashier/services/garantir-setor'
import {
    agruparRepasses,
    ajusteDoRepasse,
    contaDoRepasse,
    descricaoDesfeita,
    descricaoLiquidada,
    efeitoNoSaldo,
    ehAjusteDoRepasse,
    sentidoDoSaldo,
} from '../../services/repasse-da-plataforma'

/**
 * Liquidação do repasse das plataformas (iFood/99Food), 15/10/2026 (plano 2.3). Ver services/repasse-da-plataforma.ts.
 * O repasse da plataforma não entra na liquidação automática da maquininha (/trigger-settlement): o valor que cai pode ser
 * diferente do previsto (promoção, estorno), e só quem olha o extrato sabe.
 */

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato aaaa-mm-dd.')

const selecionar = {
    id: true, operation: true, amount: true, totalValue: true, confirmed: true, account_id: true, description: true,
    data_vencimento: true, platform_id: true, platform_settlement_id: true, cashier_session_id: true,
} as const

/** Repasses por plataforma e data: pendentes (padrão), liquidados ou todos; filtro opcional por mês do repasse e plataforma. */
export async function listPlatformSettlements(request: FastifyRequest, reply: FastifyReply) {
    const { status, month, year, platform_id } = z.object({
        status: z.enum(['pending', 'settled', 'all']).optional().default('pending'),
        month: z.string().optional(),
        year: z.string().optional(),
        platform_id: z.string().uuid().optional(),
    }).parse(request.query)

    const where: any = { platform_id: platform_id ?? { not: null }, operation: { in: ['income', 'expense'] } }
    if (status === 'pending') where.confirmed = false
    if (status === 'settled') where.platform_settlement_id = { not: null }
    if (status === 'all') where.OR = [{ confirmed: false }, { platform_settlement_id: { not: null } }]
    if (month && year) {
        const m = parseInt(month, 10)
        const y = parseInt(year, 10)
        const primeiro = `${y}-${String(m).padStart(2, '0')}-01`
        const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
        where.data_vencimento = { gte: intervaloDoDiaDeBrasilia(primeiro).inicio, lt: intervaloDoDiaDeBrasilia(ultimo).fim }
    }

    const [transacoes, plataformas] = await Promise.all([
        prisma.transaction.findMany({ where, select: selecionar, orderBy: { data_vencimento: 'asc' } }),
        prisma.deliveryPlatform.findMany({ select: { id: true, code: true, name: true, account_id: true } }),
    ])
    // O ajuste da liquidação vence no dia da baixa, que pode cair fora do mês: entra junto com o resto da liquidação
    if (month && year && status !== 'pending') {
        const liquidacoes = [...new Set(transacoes.map(t => t.platform_settlement_id).filter((x): x is string => !!x))]
        const ja = new Set(transacoes.map(t => t.id))
        if (liquidacoes.length > 0) {
            const ajustes = await prisma.transaction.findMany({ where: { platform_settlement_id: { in: liquidacoes }, cashier_session_id: null }, select: selecionar })
            transacoes.push(...ajustes.filter(a => !ja.has(a.id)))
        }
    }
    return reply.status(200).send({ data: agruparRepasses(transacoes, plataformas) })
}

/**
 * Baixa o repasse de uma plataforma numa data: os repasses (receitas) e as comissões (despesas) pendentes dessa plataforma e
 * data, de todos os caixas, vão para a conta e ficam pagos; a conta recebe o que caiu (received_amount; sem ele, o previsto).
 * A diferença vira um ajuste com motivo, no setor "Taxas de plataforma".
 * Saldo negativo (15/10/2026, "conta corrente da plataforma"): as comissões e taxas passaram as receitas (pedidos pagos na
 * entrega), então a loja é que paga a plataforma (boleto, débito). received_amount vai NEGATIVO (o que saiu da conta), a conta
 * escolhida perde esse valor e a resposta diz sentido "A_PAGAR". Zero também liquida (só fecha o que estava pendente).
 */
export async function settlePlatformPayout(request: FastifyRequest, reply: FastifyReply) {
    const corpo = z.object({
        platform_id: z.string().uuid(),
        payout_date: dia,
        received_amount: z.number().finite().optional(),
        reason: z.string().trim().max(300).optional().nullable(),
        account_id: z.string().uuid().optional().nullable(),
    }).safeParse(request.body)
    if (!corpo.success) {
        return reply.status(400).send({ message: corpo.error.issues[0]?.message || 'Dados inválidos.', issues: corpo.error.format() })
    }
    const { platform_id, payout_date, received_amount, reason, account_id } = corpo.data

    const plataforma = await prisma.deliveryPlatform.findUnique({ where: { id: platform_id } })
    if (!plataforma) return reply.status(404).send({ message: 'Plataforma não encontrada.' })

    const { inicio, fim } = intervaloDoDiaDeBrasilia(payout_date)
    const pendentes = await prisma.transaction.findMany({
        where: {
            platform_id, confirmed: false, platform_settlement_id: null,
            operation: { in: ['income', 'expense'] },
            data_vencimento: { gte: inicio, lt: fim },
        },
        select: selecionar,
    })
    if (pendentes.length === 0) {
        return reply.status(404).send({ message: `Nenhum repasse pendente do ${plataforma.name} para ${payout_date.split('-').reverse().join('/')}.` })
    }

    const contas = await prisma.account.findMany({ select: { id: true, is_transit: true } })
    const deTransacao = new Set(contas.filter(c => c.is_transit).map(c => c.id))
    const destino = contaDoRepasse(account_id, plataforma.account_id, pendentes, deTransacao)
    const [grupo] = agruparRepasses(pendentes, [plataforma])
    const aPagar = grupo.sentido === 'A_PAGAR'
    if (!destino) {
        return reply.status(400).send({
            code: 'ESCOLHA_A_CONTA',
            saldo_previsto: grupo.previsto,
            sentido: grupo.sentido,
            message: aPagar
                ? `O ${plataforma.name} não tem conta ligada. Escolha a conta de onde saiu o pagamento à plataforma.`
                : `O ${plataforma.name} não tem conta ligada. Escolha a conta onde o repasse caiu.`,
        })
    }
    if (!contas.some(c => c.id === destino)) return reply.status(400).send({ message: 'Conta não encontrada.' })
    if (deTransacao.has(destino)) {
        return reply.status(400).send({ message: 'A Conta de Transação só guarda o repasse até a baixa. Escolha a conta do banco onde ele caiu.' })
    }

    const recebido = received_amount ?? grupo.previsto
    const ajuste = ajusteDoRepasse(grupo.previsto, recebido)
    if (ajuste && !reason) {
        return reply.status(400).send({ code: 'MOTIVO_DA_DIFERENCA', message: 'O valor que caiu é diferente do previsto. Diga o motivo da diferença (promoção, estorno...).' })
    }

    const settlementId = randomUUID()
    const dataBR = payout_date.split('-').reverse().join('/')
    await prisma.$transaction(async (tx) => {
        for (const t of pendentes) {
            await tx.transaction.update({
                where: { id: t.id },
                data: { confirmed: true, account_id: destino, description: descricaoLiquidada(t.description), platform_settlement_id: settlementId },
            })
        }
        const movidas = pendentes.map(t => ({ ...t, account_id: destino }))
        if (ajuste) {
            const sector_id = ajuste.operation === 'expense' ? await setoresPorNome(tx)(SETOR_TAXAS_DE_PLATAFORMA) : null
            const criado = await tx.transaction.create({
                data: {
                    operation: ajuste.operation,
                    amount: ajuste.amount,
                    totalValue: ajuste.amount,
                    description: `Ajuste do repasse ${plataforma.name} de ${dataBR}: ${reason}`,
                    confirmed: true,
                    payment_method: METODO_DA_PLATAFORMA,
                    account_id: destino,
                    sector_id,
                    data_vencimento: vencimentoDoDia(payout_date),
                    data_emissao: new Date(),
                    platform_id,
                    platform_settlement_id: settlementId,
                },
                select: { operation: true, amount: true, totalValue: true, account_id: true },
            })
            movidas.push(criado as any)
        }
        for (const [conta, delta] of efeitoNoSaldo(movidas)) {
            if (delta !== 0) await tx.account.update({ where: { id: conta }, data: { balance: { increment: delta } } })
        }
    })

    const sentido = sentidoDoSaldo(recebido)
    const valorBR = Math.abs(recebido).toFixed(2).replace('.', ',')
    return reply.status(200).send({
        message: sentido === 'A_PAGAR'
            ? `Saldo do ${plataforma.name} de ${dataBR} liquidado: a loja pagou R$ ${valorBR} à plataforma.`
            : `Repasse do ${plataforma.name} de ${dataBR} liquidado.`,
        settlement_id: settlementId,
        account_id: destino,
        previsto: grupo.previsto,
        saldo_previsto: grupo.previsto,
        recebido,
        sentido,
        diferenca: ajuste ? (ajuste.operation === 'income' ? ajuste.amount : -ajuste.amount) : 0,
    })
}

/**
 * Desfaz uma liquidação de repasse inteira: o repasse e as comissões voltam a pendentes (na conta para onde foram, como a
 * maquininha), o ajuste da diferença é apagado e o saldo da conta volta. Também chamado pelo "reverter" de uma liquidação
 * (DELETE /settlements/:id) quando ela é de plataforma.
 */
export async function desfazerLiquidacaoDoRepasse(settlementId: string): Promise<number> {
    const transacoes = await prisma.transaction.findMany({ where: { platform_settlement_id: settlementId }, select: selecionar })
    if (transacoes.length === 0) return 0
    await prisma.$transaction(async (tx) => {
        for (const [conta, delta] of efeitoNoSaldo(transacoes.filter(t => t.confirmed))) {
            if (delta !== 0) await tx.account.update({ where: { id: conta }, data: { balance: { decrement: delta } } })
        }
        const ajustes = transacoes.filter(ehAjusteDoRepasse)
        if (ajustes.length > 0) await tx.transaction.deleteMany({ where: { id: { in: ajustes.map(a => a.id) } } })
        for (const t of transacoes.filter(t => !ehAjusteDoRepasse(t))) {
            await tx.transaction.update({
                where: { id: t.id },
                data: { confirmed: false, platform_settlement_id: null, description: descricaoDesfeita(t.description) },
            })
        }
    })
    return transacoes.length
}

export async function revertPlatformSettlement(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const desfeitas = await desfazerLiquidacaoDoRepasse(id)
    if (desfeitas === 0) return reply.status(404).send({ message: 'Liquidação de repasse não encontrada.' })
    return reply.status(200).send({ message: 'Liquidação do repasse desfeita: o repasse e as comissões voltaram a pendentes.' })
}
