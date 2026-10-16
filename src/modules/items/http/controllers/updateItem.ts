import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeUpdateItemUseCase } from '@/modules/items/use-cases/factories/make-update-item-use-case'
import { prisma } from '@/lib/prisma'
import { AlvoDoEstoque, registrarMovimento, usuarioDaRequisicao } from '@/modules/stock/services/movimento-de-estoque'

/**
 * Saldo mudado no cadastro do produto ou do insumo (16/10/2026): vira um AJUSTE no histórico, com quem mudou e o saldo, em vez
 * de gravar o número por cima em silêncio. Antes, salvar o cadastro com a tela aberta havia horas regravava o saldo antigo e
 * desfazia as baixas das vendas sem deixar rastro.
 */
async function ajustarSaldoPeloCadastro(request: FastifyRequest, id: string, novoSaldo: number) {
    const produto = await prisma.product.findUnique({ where: { id }, select: { stock: true, cost: true } })
    const insumo = produto ? null : await prisma.supply.findUnique({ where: { id }, select: { stock: true, cost: true } })
    const atual = produto ?? insumo
    if (!atual) return
    const diferenca = Number((novoSaldo - (atual.stock ?? 0)).toFixed(6))
    if (diferenca === 0) return
    const alvo: AlvoDoEstoque = produto ? { tipo: 'PRODUCT', id } : { tipo: 'SUPPLY', id }
    const usuario = await usuarioDaRequisicao(request)
    await prisma.$transaction(async (tx) => {
        await registrarMovimento(tx, {
            alvo,
            operacao: diferenca > 0 ? 'IN' : 'OUT',
            quantidade: Math.abs(diferenca),
            motivo: diferenca > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
            custoUnitario: atual.cost ?? 0,
            saldoNovo: novoSaldo,
            usuario,
            nota: 'Saldo mudado no cadastro',
        })
    })
}

export async function updateItem(request: FastifyRequest, reply: FastifyReply) {
    const updateItemParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateItemBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        cost: z.coerce.number().nullable().optional(),
        price: z.coerce.number().nullable().optional(),
        min_stock: z.coerce.number().nullable().optional(),
        stock: z.coerce.number().nullable().optional(),
        barcode: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        estimated_time: z.string().nullable().optional(),
        unit: z.string().nullable().optional(),
        display_id: z.preprocess((val) => (val === '' || val == null) ? undefined : Number(val), z.number().optional()),
        ncm: z.string().nullable().optional(),
        cest: z.string().nullable().optional(),
        cfop: z.string().nullable().optional(),
        csosn: z.string().nullable().optional(),
        cst_icms: z.string().nullable().optional(),
        origem: z.coerce.number().nullable().optional(),
        cst_pis: z.string().nullable().optional(),
        aliquota_pis: z.coerce.number().nullable().optional(),
        cst_cofins: z.string().nullable().optional(),
        aliquota_cofins: z.coerce.number().nullable().optional(),
        subcategory_id: z.string().nullable().optional(),
        measureUnit: z.enum(['UNITARY', 'FRACTIONAL']).optional(),
        image_url: z.string().nullable().optional(),
        is_priority: z.boolean().optional(),
        show_on_menu: z.boolean().optional(),
        is_composite: z.boolean().optional(),
        compositions: z.array(z.object({
            supply_id: z.string(),
            quantity: z.coerce.number()
        })).optional()
    })

    console.log('[UpdateItem Debug] Body:', request.body)

    try {
        const { id } = updateItemParamsSchema.parse(request.params)
        const data = updateItemBodySchema.parse(request.body)
        const updateItemUseCase = makeUpdateItemUseCase()
        // O saldo não é gravado pelo cadastro: a mudança (se houver) vira um ajuste no histórico, logo depois
        const { item } = await updateItemUseCase.execute({
            id,
            ...data,
            description: data.description ?? undefined,
            min_stock: data.min_stock ?? undefined,
            stock: undefined,
            barcode: data.barcode ?? undefined,
            category: data.category ?? undefined,
            estimated_time: data.estimated_time ?? undefined,
            unit: data.unit ?? undefined,
            display_id: data.display_id ?? undefined,
            ncm: data.ncm ?? undefined,
            cest: data.cest ?? undefined,
            cfop: data.cfop ?? undefined,
            csosn: data.csosn ?? undefined,
            cst_icms: data.cst_icms ?? undefined,
            origem: data.origem ?? undefined,
            cst_pis: data.cst_pis ?? undefined,
            aliquota_pis: data.aliquota_pis ?? undefined,
            cst_cofins: data.cst_cofins ?? undefined,
            aliquota_cofins: data.aliquota_cofins ?? undefined,
            subcategory_id: data.subcategory_id ?? undefined,
            measureUnit: data.measureUnit,
            image_url: data.image_url ?? undefined,
            is_priority: data.is_priority,
            show_on_menu: data.show_on_menu,
            cost: data.cost ?? undefined,
            price: data.price ?? undefined,
        })
        if (typeof data.stock === 'number' && Number.isFinite(data.stock)) {
            await ajustarSaldoPeloCadastro(request, id, data.stock)
        }
        return reply.status(200).send(item)
    } catch (err) {
        console.error('[UpdateItem Error]:', err)

        if (err instanceof z.ZodError) {
            console.error('[UpdateItem Validation Error]:', JSON.stringify(err.format(), null, 2))
            return reply.status(400).send({
                message: 'Erro de validação nos campos: ' + err.issues.map(i => i.path.join('.')).join(', '),
                issues: err.issues
            })
        }

        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
