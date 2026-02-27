import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma' // Assuming lib/prisma exposes the prisma client

export async function getMenu(request: FastifyRequest, reply: FastifyReply) {
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
