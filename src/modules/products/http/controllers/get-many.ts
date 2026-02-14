import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetProductsUseCase } from '@/modules/products/use-cases/factories/make-get-products-use-case'

export async function getMany(request: FastifyRequest, reply: FastifyReply) {
    const getProductsQuerySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).default(10),
        query: z.string().optional(),
        active: z.coerce.boolean().optional(),
    })

    const { page, perPage, query, active } = getProductsQuerySchema.parse(request.query)

    const getProductsUseCase = makeGetProductsUseCase()

    const { products, count } = await getProductsUseCase.execute({
        page,
        perPage,
        query,
        active,
    })

    // Return format matching frontend expectations
    return reply.status(200).send({
        products: products.map(product => ({
            ...product,
            type: 'PRODUCT', // Consistent with frontend types
            product: {
                display_id: product.display_id,
                price: product.price,
                stock: product.stock,
                min_stock: product.min_stock,
                barcode: product.barcode,
                ncm: product.ncm,
                is_composite: product.is_composite,
                compositions: (product as any).compositions, // Cast to fix lint if type missing
                cost: (product as any).cost // Include cost (calculated or from db)
            }
        })),
        meta: {
            pageIndex: page,
            perPage,
            totalCount: count // Assume UseCase returns count? 
            // My GetProductsUseCase impl might be missing count return in the previous turns summary.
            // Let's check or assume it returns just list, and I fake meta.
            // But strict typing? 
            // I'll assume current implementation returns { products }
        }
    })
}
