import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function getMenu(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')

    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
    }

    try {
        const products = await prisma.product.findMany({
            where: {
                active: true,
            },
            select: {
                id: true,
                name: true,
                price: true,
                description: true,
                measureUnit: true,
                category: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return reply.status(200).send({
            products: products.map(product => ({
                id: product.id,
                name: product.name,
                price: product.price,
                description: product.description,
                measureUnit: product.measureUnit,
                category: product.category?.name || 'Geral'
            }))
        })
    } catch (error) {
        console.error("Error fetching menu:", error)
        return reply.status(500).send({ message: 'Internal server error while fetching menu' })
    }
}
