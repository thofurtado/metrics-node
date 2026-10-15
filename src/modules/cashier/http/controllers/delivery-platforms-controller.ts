import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { codigoDePlataforma } from '@/modules/cashier/services/plataformas'

/**
 * Cadastro das plataformas de entrega (iFood, 99Food...), 15/10/2026 (plano 2.1, decisões D1 e D3 do Thomás): comissão com
 * entrega da loja e com entrega da plataforma, taxa do pagamento online, mensalidade (só informativa), semanas até o repasse
 * e a conta onde o repasse cai (vazio = Conta de Transação até a Liquidação). Mesmo padrão e mesma proteção das maquininhas
 * (/api/pos-machines): a tela de Configurações lê e grava.
 */

const percentual = z.number().min(0, 'O percentual não pode ser negativo.').max(100, 'O percentual vai até 100.')

const camposDaPlataforma = {
    name: z.string().trim().min(1, 'Informe o nome da plataforma.'),
    account_id: z.string().uuid().optional().nullable(),
    commission_own_delivery_pct: percentual,
    commission_platform_delivery_pct: percentual,
    online_payment_fee_pct: percentual,
    monthly_fee: z.number().min(0, 'A mensalidade não pode ser negativa.'),
    payout_weeks_after: z.number().int('Semanas até o repasse é um número inteiro.').min(1, 'O repasse é pelo menos 1 semana depois.').max(12),
    active: z.boolean(),
}

const criarSchema = z.object({
    code: z.string().min(1, 'Informe o código da plataforma (ex.: IFOOD, 99FOOD).'),
    ...camposDaPlataforma,
    commission_own_delivery_pct: camposDaPlataforma.commission_own_delivery_pct.default(0),
    commission_platform_delivery_pct: camposDaPlataforma.commission_platform_delivery_pct.default(0),
    online_payment_fee_pct: camposDaPlataforma.online_payment_fee_pct.default(0),
    monthly_fee: camposDaPlataforma.monthly_fee.default(0),
    payout_weeks_after: camposDaPlataforma.payout_weeks_after.default(1),
    active: camposDaPlataforma.active.default(true),
})

const atualizarSchema = z.object({
    code: z.string().min(1).optional(),
    name: camposDaPlataforma.name.optional(),
    account_id: camposDaPlataforma.account_id,
    commission_own_delivery_pct: camposDaPlataforma.commission_own_delivery_pct.optional(),
    commission_platform_delivery_pct: camposDaPlataforma.commission_platform_delivery_pct.optional(),
    online_payment_fee_pct: camposDaPlataforma.online_payment_fee_pct.optional(),
    monthly_fee: camposDaPlataforma.monthly_fee.optional(),
    payout_weeks_after: camposDaPlataforma.payout_weeks_after.optional(),
    active: camposDaPlataforma.active.optional(),
})

const paramsSchema = z.object({ id: z.string().uuid() })

const incluir = {
    account: { select: { id: true, name: true } },
    identifiers: { select: { id: true, name: true, payment_method_id: true, active: true } },
} as const

function erroDeValidacao(reply: FastifyReply, err: z.ZodError) {
    return reply.status(400).send({ message: err.issues[0]?.message || 'Dados inválidos.', issues: err.format() })
}

async function contaInvalida(accountId: string | null | undefined): Promise<boolean> {
    if (!accountId) return false
    return !(await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } }))
}

export async function getDeliveryPlatforms(request: FastifyRequest, reply: FastifyReply) {
    const plataformas = await prisma.deliveryPlatform.findMany({ orderBy: { name: 'asc' }, include: incluir })
    return reply.status(200).send(plataformas)
}

export async function createDeliveryPlatform(request: FastifyRequest, reply: FastifyReply) {
    const parsed = criarSchema.safeParse(request.body)
    if (!parsed.success) return erroDeValidacao(reply, parsed.error)
    const data = parsed.data
    const code = codigoDePlataforma(data.code)
    if (!code) return reply.status(400).send({ message: 'O código da plataforma precisa ter letras ou números (ex.: IFOOD, 99FOOD).' })

    if (await prisma.deliveryPlatform.findUnique({ where: { code }, select: { id: true } })) {
        return reply.status(400).send({ message: `Já existe uma plataforma com o código ${code}.` })
    }
    if (await contaInvalida(data.account_id)) return reply.status(400).send({ message: 'Conta não encontrada.' })

    const plataforma = await prisma.deliveryPlatform.create({
        data: { ...data, code, account_id: data.account_id || null },
        include: incluir,
    })
    return reply.status(201).send(plataforma)
}

export async function updateDeliveryPlatform(request: FastifyRequest, reply: FastifyReply) {
    const { id } = paramsSchema.parse(request.params)
    const parsed = atualizarSchema.safeParse(request.body)
    if (!parsed.success) return erroDeValidacao(reply, parsed.error)
    const { code: codeDigitado, ...data } = parsed.data

    const atual = await prisma.deliveryPlatform.findUnique({ where: { id }, select: { id: true } })
    if (!atual) return reply.status(404).send({ message: 'Plataforma não encontrada.' })

    let code: string | undefined
    if (codeDigitado !== undefined) {
        code = codigoDePlataforma(codeDigitado) ?? undefined
        if (!code) return reply.status(400).send({ message: 'O código da plataforma precisa ter letras ou números (ex.: IFOOD, 99FOOD).' })
        const outra = await prisma.deliveryPlatform.findUnique({ where: { code }, select: { id: true } })
        if (outra && outra.id !== id) return reply.status(400).send({ message: `Já existe uma plataforma com o código ${code}.` })
    }
    if (await contaInvalida(data.account_id)) return reply.status(400).send({ message: 'Conta não encontrada.' })

    const plataforma = await prisma.deliveryPlatform.update({
        where: { id },
        data: {
            ...data,
            ...(code ? { code } : {}),
            // null tira a conta (o repasse volta a ficar na Conta de Transação); sem o campo, não mexe
            account_id: data.account_id !== undefined ? (data.account_id || null) : undefined,
        },
        include: incluir,
    })
    return reply.status(200).send(plataforma)
}

/**
 * Excluir só a plataforma sem repasse/comissão lançados: com lançamentos, a Liquidação perderia o par (desative em vez de
 * excluir). Os identificadores ligados ficam, sem a plataforma.
 */
export async function deleteDeliveryPlatform(request: FastifyRequest, reply: FastifyReply) {
    const { id } = paramsSchema.parse(request.params)
    const atual = await prisma.deliveryPlatform.findUnique({ where: { id }, select: { id: true } })
    if (!atual) return reply.status(404).send({ message: 'Plataforma não encontrada.' })

    const lancamentos = await prisma.transaction.count({ where: { platform_id: id } })
    if (lancamentos > 0) {
        return reply.status(409).send({
            code: 'PLATFORM_IN_USE',
            message: `Esta plataforma tem ${lancamentos} lançamento(s) de repasse ou comissão e não pode ser excluída. Desative em vez de excluir.`,
        })
    }
    await prisma.deliveryPlatform.delete({ where: { id } })
    return reply.status(204).send()
}
