import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getProductsSync(request: FastifyRequest, reply: FastifyReply) {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            active: true,
            category_id: true,
            display_id: true
        }
    })

    // Mapear para o formato que o C# espera:
    // Uuid, Name, Description, Price, Active, CategoryId, Id (display_id se for numero, ou algo similar)
    const formatted = products.map(p => ({
        Uuid: p.id,
        Id: p.display_id,
        Name: p.name,
        Description: p.description,
        Price: p.price,
        Active: p.active,
        CategoryId: p.category_id
    }))

    return reply.status(200).send(formatted)
}

export async function getUsersSync(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            password_hash: true,
            role: true,
            created_at: true
        }
    })

    const formatted = users.map(u => ({
        Uuid: u.id,
        Name: u.name,
        Email: u.email,
        PasswordHash: u.password_hash,
        Role: u.role,
        Active: true, // Backend C# pode precisar
        CreatedAt: u.created_at
    }))

    return reply.status(200).send(formatted)
}

export async function postStocksSync(request: FastifyRequest, reply: FastifyReply) {
    const stockMovementSchema = z.array(
        z.object({
            productId: z.union([z.string().uuid(), z.number()]), // backend agora aceita UUID ou Int
            quantity: z.number(),
            type: z.enum(['IN', 'OUT']),
            reason: z.enum(['COMPRA', 'VENDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO', 'QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO']).optional().default('VENDA'),
            createdAt: z.string().datetime().optional()
        })
    )

    const movements = stockMovementSchema.parse(request.body)

    // Vamos processar de forma transacional
    for (const mov of movements) {
        // Encontra o UUID do produto usando id ou display_id
        const product = await prisma.product.findFirst({
            where: typeof mov.productId === 'string' 
                ? { id: mov.productId }
                : { display_id: mov.productId }
        })

        if (!product) {
            console.warn(`[Sync] Produto com identificador ${mov.productId} não encontrado.`)
            continue // Skip se não achar, para não travar os outros
        }

        // Insere a movimentação
        await prisma.stock.create({
            data: {
                product_id: product.id,
                quantity: mov.quantity,
                operation: mov.type,
                description: mov.reason,
                created_at: mov.createdAt ? new Date(mov.createdAt) : new Date()
            }
        })

        // Atualiza o saldo do produto
        await prisma.product.update({
            where: { id: product.id },
            data: {
                stock: mov.type === 'IN' 
                    ? { increment: mov.quantity } 
                    : { decrement: mov.quantity }
            }
        })
    }

    return reply.status(201).send({ message: 'Movimentações sincronizadas com sucesso' })
}

export async function getSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
        const maxUser = await prisma.user.aggregate({
            _max: {
                updated_at: true
            }
        })

        const maxProduct = await prisma.product.aggregate({
            _max: {
                updated_at: true
            }
        })

        // Retorna a data correspondente ou a data da época (epoch) caso as tabelas estejam vazias
        const lastUserModified = maxUser._max.updated_at || new Date(0)
        const lastProductModified = maxProduct._max.updated_at || new Date(0)

        return reply.status(200).send({
            lastUserModified: lastUserModified.toISOString(),
            lastProductModified: lastProductModified.toISOString()
        })
    } catch (error: any) {
        console.error('[Sync] Erro ao obter status de sincronização:', error)
        return reply.status(500).send({
            message: 'Erro ao processar status de sincronização',
            details: error.message
        })
    }
}

