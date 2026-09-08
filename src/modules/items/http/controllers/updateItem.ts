import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeUpdateItemUseCase } from '@/modules/items/use-cases/factories/make-update-item-use-case'

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
        const { item } = await updateItemUseCase.execute({
            id,
            ...data,
            description: data.description ?? undefined,
            min_stock: data.min_stock ?? undefined,
            stock: data.stock ?? undefined,
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
            is_priority: data.is_priority,
            show_on_menu: data.show_on_menu,
            cost: data.cost ?? undefined,
            price: data.price ?? undefined,
        })
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
