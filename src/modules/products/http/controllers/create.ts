import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateProductUseCase } from '@/modules/products/use-cases/factories/make-create-product-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createProductBodySchema = z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        price: z.number(),
        stock: z.number().nullable().optional(),
        min_stock: z.number().nullable().optional(),
        barcode: z.string().nullable().optional(),
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
        show_on_menu: z.boolean().nullable().optional(),
        is_priority: z.boolean().nullable().optional(),
        display_id: z.number().nullable().optional(),
        is_composite: z.boolean().default(false),
        measureUnit: z.enum(['UNITARY', 'FRACTIONAL']).optional(),
        cost: z.number().nullable().optional(),
        compositions: z.array(z.object({
            supply_id: z.string().uuid(),
            quantity: z.number()
        })).optional()
    })

    const body = createProductBodySchema.parse(request.body)

    const createProductUseCase = makeCreateProductUseCase()

    const { product } = await createProductUseCase.execute(body)

    return reply.status(201).send(product)
}
