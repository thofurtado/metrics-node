import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getProductsSync(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        lastSync: z.string().datetime().optional()
    })
    
    const { lastSync } = querySchema.parse(request.query)

    const products = await prisma.product.findMany({
        where: lastSync ? {
            updated_at: { gt: new Date(lastSync) }
        } : {
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
            updated_at: true,
            image_url: true,
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
        CategoryName: p.category?.name || "Geral",
        UpdatedAt: p.updated_at,
        ImageUrl: p.image_url
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

export async function getPrintDepartmentsSync(request: FastifyRequest, reply: FastifyReply) {
    const departments = await prisma.printDepartment.findMany({
        include: {
            products: true
        }
    })

    const formatted = departments.map(d => ({
        Uuid: d.id,
        Name: d.name,
        ProductUuids: d.products.map(p => p.product_id),
        CreatedAt: d.created_at,
        UpdatedAt: d.updated_at
    }))

    return reply.status(200).send(formatted)
}


export async function getPaymentsSync(request: FastifyRequest, reply: FastifyReply) {
    const payments = await prisma.payment.findMany({ where: { active: true, active_for_in: true } })
    const formatted = payments.map(p => ({
        Uuid: p.id,
        Name: p.name,
        InstallmentLimit: p.installment_limit,
        InSight: p.in_sight,
        AccountId: p.account_id,
        Active: p.active,
        SefazTpag: p.sefaz_tPag,
        CreatedAt: p.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPaymentIdentifiersSync(request: FastifyRequest, reply: FastifyReply) {
    const identifiers = await prisma.paymentIdentifier.findMany({ where: { active: true } })
    const formatted = identifiers.map(i => ({
        Uuid: i.id,
        Name: i.name,
        IsCorrentistaDebt: i.is_correntista_debt,
        IsStockEvasion: i.is_stock_evasion,
        Active: i.active,
        CreatedAt: i.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPaymentConditionsSync(request: FastifyRequest, reply: FastifyReply) {
    const conditions = await prisma.paymentCondition.findMany({ where: { active: true } })
    const formatted = conditions.map(c => ({
        Uuid: c.id,
        Name: c.name,
        Installments: c.installments,
        Active: c.active,
        CreatedAt: c.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPOSMachinesSync(request: FastifyRequest, reply: FastifyReply) {
    const machines = await prisma.pOSMachine.findMany({ where: { active: true } })
    const formatted = machines.map(m => ({
        Uuid: m.id,
        Name: m.name,
        AccountId: m.account_id,
        Active: m.active,
        CreatedAt: m.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getSystemConfigSync(request: FastifyRequest, reply: FastifyReply) {
    let config = await prisma.systemConfig.findFirst()
    if (!config) {
        config = await prisma.systemConfig.create({ data: {} })
    }
    return reply.status(200).send({
        BlindCashierClosure: config.blind_cashier_closure,
        CashierDefaultOrigin: config.cashier_default_origin
    })
}


export async function postProductsBulkSync(request: FastifyRequest, reply: FastifyReply) {
    const bulkSchema = z.object({
        products: z.array(
            z.object({
                externalId: z.string().nullable().optional(),
                name: z.string(),
                price: z.number(),
                cost: z.number().nullable().optional(),
                barcode: z.string().nullable().optional(),
                ncm: z.string().nullable().optional(),
                cest: z.string().nullable().optional(),
                cfop: z.string().nullable().optional(),
                csosn: z.string().nullable().optional(),
                cstIcms: z.string().nullable().optional(),
                origem: z.number().nullable().optional(),
                cstPis: z.string().nullable().optional(),
                aliquotaPis: z.number().nullable().optional(),
                cstCofins: z.string().nullable().optional(),
                aliquotaCofins: z.number().nullable().optional(),
                categoryName: z.string().nullable().optional(),
                subcategoryName: z.string().nullable().optional(),
                active: z.boolean().nullable().optional(),
                stock: z.number().nullable().optional(),
                description: z.string().nullable().optional()
            })
        )
    })

    const { products } = bulkSchema.parse(request.body)

    let created = 0
    let updated = 0
    let unchanged = 0

    const maxDisplay = await prisma.product.aggregate({
        _max: { display_id: true }
    })
    let currentMaxDisplayId = maxDisplay._max.display_id ?? 0

    for (const p of products) {
        if (!p.name || !p.name.trim()) continue

        const name = p.name.trim()
        const catName = p.categoryName?.trim()

        // 1. Categoria e Subcategoria (find or create)
        let categoryId: string | null = null
        let subcategoryId: string | null = null
        if (catName) {
            let category = await prisma.category.findUnique({
                where: { name: catName }
            })
            if (!category) {
                category = await prisma.category.create({
                    data: { name: catName }
                })
            }
            categoryId = category.id

            if (p.subcategoryName?.trim()) {
                const subName = p.subcategoryName.trim()
                let subcategory = await prisma.subcategory.findFirst({
                    where: { name: subName, category_id: categoryId }
                })
                if (!subcategory) {
                    subcategory = await prisma.subcategory.create({
                        data: {
                            name: subName,
                            category_id: categoryId
                        }
                    })
                }
                subcategoryId = subcategory.id
            }
        }

        // 2. Busca se o produto ja existe pelo nome ou codigo de barras
        const existing = await prisma.product.findFirst({
            where: {
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    ...(p.barcode && p.barcode.trim() ? [{ barcode: p.barcode.trim() }] : [])
                ]
            }
        })

        if (existing) {
            const hasChanged = 
                existing.price !== p.price ||
                (p.cost !== undefined && p.cost !== null && existing.cost !== p.cost) ||
                (p.stock !== undefined && p.stock !== null && existing.stock !== p.stock) ||
                (p.active !== undefined && p.active !== null && existing.active !== p.active) ||
                (categoryId && existing.category_id !== categoryId) ||
                (p.barcode && existing.barcode !== p.barcode.trim()) ||
                (p.description && existing.description !== p.description)

            if (hasChanged) {
                await prisma.product.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        price: p.price,
                        cost: p.cost !== undefined && p.cost !== null ? p.cost : existing.cost,
                        stock: p.stock !== undefined && p.stock !== null ? p.stock : existing.stock,
                        barcode: p.barcode && p.barcode.trim() ? p.barcode.trim() : existing.barcode,
                        ncm: p.ncm && p.ncm.trim() ? p.ncm.trim() : existing.ncm,
                        cest: p.cest && p.cest.trim() ? p.cest.trim() : existing.cest,
                        cfop: p.cfop && p.cfop.trim() ? p.cfop.trim() : existing.cfop,
                        csosn: p.csosn && p.csosn.trim() ? p.csosn.trim() : existing.csosn,
                        cst_icms: p.cstIcms && p.cstIcms.trim() ? p.cstIcms.trim() : existing.cst_icms,
                        origem: p.origem !== undefined && p.origem !== null ? p.origem : existing.origem,
                        cst_pis: p.cstPis && p.cstPis.trim() ? p.cstPis.trim() : existing.cst_pis,
                        aliquota_pis: p.aliquotaPis !== undefined && p.aliquotaPis !== null ? p.aliquotaPis : existing.aliquota_pis,
                        cst_cofins: p.cstCofins && p.cstCofins.trim() ? p.cstCofins.trim() : existing.cst_cofins,
                        aliquota_cofins: p.aliquotaCofins !== undefined && p.aliquotaCofins !== null ? p.aliquotaCofins : existing.aliquota_cofins,
                        category_id: categoryId ?? existing.category_id,
                        subcategory_id: subcategoryId ?? existing.subcategory_id,
                        active: p.active !== undefined && p.active !== null ? p.active : existing.active,
                        description: p.description !== undefined && p.description !== null ? p.description : existing.description,
                        updated_at: new Date()
                    }
                })
                updated++
            } else {
                unchanged++
            }
        } else {
            currentMaxDisplayId++
            await prisma.product.create({
                data: {
                    name,
                    price: p.price,
                    cost: p.cost ?? 0,
                    stock: p.stock ?? 0,
                    min_stock: 0,
                    barcode: p.barcode && p.barcode.trim() ? p.barcode.trim() : null,
                    ncm: p.ncm && p.ncm.trim() ? p.ncm.trim() : null,
                    cest: p.cest && p.cest.trim() ? p.cest.trim() : null,
                    cfop: p.cfop && p.cfop.trim() ? p.cfop.trim() : null,
                    csosn: p.csosn && p.csosn.trim() ? p.csosn.trim() : null,
                    cst_icms: p.cstIcms && p.cstIcms.trim() ? p.cstIcms.trim() : null,
                    origem: p.origem ?? 0,
                    cst_pis: p.cstPis && p.cstPis.trim() ? p.cstPis.trim() : null,
                    aliquota_pis: p.aliquotaPis ?? 0,
                    cst_cofins: p.cstCofins && p.cstCofins.trim() ? p.cstCofins.trim() : null,
                    aliquota_cofins: p.aliquotaCofins ?? 0,
                    category_id: categoryId,
                    subcategory_id: subcategoryId,
                    active: p.active !== undefined && p.active !== null ? p.active : true,
                    description: p.description || null,
                    display_id: currentMaxDisplayId
                }
            })
            created++
        }
    }

    return reply.status(200).send({
        created,
        updated,
        unchanged,
        message: `Sincronização de produtos realizada com sucesso! (${created} criados, ${updated} atualizados, ${unchanged} inalterados).`
    })
}