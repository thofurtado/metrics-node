import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function fetch(request: FastifyRequest, reply: FastifyReply) {
    const departments = await prisma.printDepartment.findMany({
        include: {
            products: {
                include: { product: true }
            }
        },
        orderBy: { name: 'asc' }
    })
    return reply.status(200).send({ departments })
}

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({ name: z.string().min(1) })
    const { name } = schema.parse(request.body)
    
    // Check if already exists
    const exists = await prisma.printDepartment.findUnique({ where: { name } })
    if (exists) {
        return reply.status(409).send({ message: 'Departamento já existe' })
    }

    const department = await prisma.printDepartment.create({
        data: { name }
    })
    return reply.status(201).send({ department })
}

export async function remove(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({ id: z.string() })
    const { id } = schema.parse(request.params)
    await prisma.printDepartment.delete({ where: { id } })
    return reply.status(204).send()
}

export async function updateProducts(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string() })
    const bodySchema = z.object({ productIds: z.array(z.string()) })
    
    const { id } = paramsSchema.parse(request.params)
    const { productIds } = bodySchema.parse(request.body)

    // Remove todos os produtos atuais deste departamento
    await prisma.productPrintDepartment.deleteMany({
        where: { print_department_id: id }
    })
    
    // Adiciona os novos, se houver
    if (productIds.length > 0) {
        await prisma.productPrintDepartment.createMany({
            data: productIds.map(productId => ({
                print_department_id: id,
                product_id: productId
            }))
        })
    }
    
    return reply.status(204).send()
}
