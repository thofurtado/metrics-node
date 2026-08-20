import { MakeItemUseCase } from '@/modules/items/use-cases/factories/make-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ItemType } from '@/modules/items/use-cases/item'

export async function createItem(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        cost: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        stock: z.number().nullable().optional(),
        min_stock: z.number().nullable().optional(),
        barcode: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        type: z.nativeEnum(ItemType),
        display_id: z.preprocess((val) => (val === '' || val == null) ? undefined : Number(val), z.number().optional()),
        ncm: z.string().nullable().optional(),
        estimated_time: z.string().nullable().optional(),
        unit: z.string().nullable().optional()
    })

    let item
    try {
        const { name, description, cost, price, stock, min_stock, barcode, category, active, type, display_id, ncm, estimated_time, unit } = registerBodySchema.parse(request.body)
        const itemUseCase = MakeItemUseCase()

        item = await itemUseCase.execute({
            name,
            description: description ?? undefined,
            cost: cost ?? 0,
            price: price ?? 0,
            stock: stock ?? undefined,
            min_stock: min_stock ?? undefined,
            barcode: barcode ?? undefined,
            category: category ?? undefined,
            active: active ?? undefined,
            type,
            display_id: display_id ?? undefined,
            ncm: ncm ?? undefined,
            estimated_time: estimated_time ?? undefined,
            unit: unit ?? undefined
        })
    } catch (err) {
        console.error('[CreateItem Error]:', err)

        if (err instanceof z.ZodError) {
            return reply.status(400).send({
                message: 'Erro de validação nos campos: ' + err.issues.map(i => i.path.join('.')).join(', '),
                issues: err.issues
            })
        }

        if (err instanceof Error) {
            if ('code' in err && err.code === 'P2002') {
                const target = (err as any).meta?.target;
                if (Array.isArray(target)) {
                    if (target.includes('display_id')) {
                        return reply.status(400).send({ message: 'Este código de identificação já está em uso' })
                    }
                    if (target.includes('name')) {
                        return reply.status(400).send({ message: 'Já existe um item cadastrado com este nome' })
                    }
                }
            }
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(200).send(item)
}
