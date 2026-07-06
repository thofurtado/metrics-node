import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getProductsSync(request: FastifyRequest, reply: FastifyReply) {
    const products = await prisma.product.findMany({
        where: {
            active: true
        },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            active: true,
            category_id: true,
            display_id: true,
            category: {
                select: {
                    name: true
                }
            }
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
        CategoryId: p.category_id,
        CategoryName: p.category?.name || "Geral"
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

export async function getClientsSync(request: FastifyRequest, reply: FastifyReply) {
    const clients = await prisma.client.findMany({
        include: {
            addresses: {
                where: { is_main: true }
            }
        }
    })

    const formatted = clients.map(c => ({
        Uuid: c.id,
        Name: c.name,
        Identification: c.identification, // CpfCnpj no C#
        Email: c.email,
        Phone: c.phone, // Telefone no C#
        CreatedAt: c.created_at,
        Address: c.addresses.length > 0 ? {
            Street: c.addresses[0].street,
            Number: c.addresses[0].number,
            Neighborhood: c.addresses[0].neighborhood,
            City: c.addresses[0].city,
            State: c.addresses[0].state,
            Zipcode: c.addresses[0].zipcode,
            Complement: c.addresses[0].complement
        } : null
    }))

    return reply.status(200).send(formatted)
}

export async function postClientsSync(request: FastifyRequest, reply: FastifyReply) {
    const clientsSchema = z.array(
        z.object({
            Uuid: z.string().uuid(),
            Name: z.string(),
            Identification: z.string().nullable().optional(),
            Email: z.string().nullable().optional(),
            Phone: z.string().nullable().optional(),
            CreatedAt: z.string().datetime().optional(),
            Address: z.object({
                Street: z.string(),
                Number: z.string(),
                Neighborhood: z.string(),
                City: z.string(),
                State: z.string(),
                Zipcode: z.string().nullable().optional(),
                Complement: z.string().nullable().optional()
            }).nullable().optional()
        })
    )

    const parsedClients = clientsSchema.parse(request.body)

    for (const c of parsedClients) {
        // Upsert no client
        await prisma.client.upsert({
            where: { id: c.Uuid },
            update: {
                name: c.Name,
                identification: c.Identification || null,
                email: c.Email || null,
                phone: c.Phone || null
            },
            create: {
                id: c.Uuid,
                name: c.Name,
                identification: c.Identification || null,
                email: c.Email || null,
                phone: c.Phone || null,
                created_at: c.CreatedAt ? new Date(c.CreatedAt) : new Date()
            }
        })

        // Se veio endereço, vamos fazer um upsert tbm, marcando como is_main
        if (c.Address) {
            // Buscamos se o cliente já tem um endereço principal
            const mainAddr = await prisma.address.findFirst({
                where: { client_id: c.Uuid, is_main: true }
            })

            if (mainAddr) {
                await prisma.address.update({
                    where: { id: mainAddr.id },
                    data: {
                        street: c.Address.Street,
                        number: c.Address.Number,
                        neighborhood: c.Address.Neighborhood,
                        city: c.Address.City,
                        state: c.Address.State,
                        zipcode: c.Address.Zipcode || null,
                        complement: c.Address.Complement || null
                    }
                })
            } else {
                await prisma.address.create({
                    data: {
                        client_id: c.Uuid,
                        street: c.Address.Street,
                        number: c.Address.Number,
                        neighborhood: c.Address.Neighborhood,
                        city: c.Address.City,
                        state: c.Address.State,
                        zipcode: c.Address.Zipcode || null,
                        complement: c.Address.Complement || null,
                        is_main: true
                    }
                })
            }
        }
    }

    return reply.status(201).send({ message: 'Clientes sincronizados com sucesso' })
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

