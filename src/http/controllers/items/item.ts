import { MakeItemUseCase } from '@/use-cases/factories/make-item-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'


export async function createItem(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        description: z.string().nullish(),
        cost: z.number(),
        price: z.number(),
        stock: z.number().nullish(),
        min_stock: z.number().nullish(),
        barcode: z.string().nullish(),
        category: z.string().nullish(),
        active: z.boolean().nullish(),
        isItem: z.boolean().nullish(),
        display_id: z.preprocess((val) => val === '' ? null : Number(val), z.number().nullable().optional())
    }).refine((data) => {
        const isProduct = data.isItem !== false
        if (isProduct && (data.min_stock === undefined || data.min_stock === null)) {
            return false
        }
        return true
    }, {
        message: "Estoque mínimo é obrigatório para produtos",
        path: ["min_stock"]
    })

    const { name, description, cost, price, stock, min_stock, barcode, category, active, isItem, display_id } = registerBodySchema.parse(request.body)
    let item
    try {

        const itemUseCase = MakeItemUseCase()

        item = await itemUseCase.execute({
            name,
            description: description ? description : undefined,
            cost,
            price,
            stock: stock ? stock : undefined,
            min_stock: min_stock ? min_stock : undefined,
            barcode: barcode ? barcode : undefined,
            category: category ? category : undefined,
            active: active ? active : undefined,
            isItem: isItem ? isItem : undefined,
            display_id: display_id ? display_id : undefined
        })
    } catch (err) {

        if (err instanceof Error) {
            // Check for Prisma unique constraint violation
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
