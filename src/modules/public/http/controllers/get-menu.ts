import { FastifyReply, FastifyRequest } from 'fastify'
import { fiscaisLimpos } from '@/lib/codigos-fiscais'
import { requestContext } from '@fastify/request-context'

export async function getMenu(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')

    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
    }

    try {
        const [products, payments, complementGroups, subcategories] = await Promise.all([
            prisma.product.findMany({
                where: {
                    active: true,
                    show_on_menu: true,
                },
                select: {
                    id: true,
                    display_id: true,
                    name: true,
                    price: true,
                    barcode: true,
                    ncm: true,
                    cest: true,
                    cfop: true,
                    csosn: true,
                    cst_icms: true,
                    origem: true,
                    cst_pis: true,
                    aliquota_pis: true,
                    cst_cofins: true,
                    aliquota_cofins: true,
                    description: true,
                    measureUnit: true,
                    image_url: true,
                    is_priority: true,
                    category: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    subcategory: {
                        select: {
                            id: true,
                            name: true,
                            accepts_fractions: true,
                            max_fractions: true,
                        }
                    },
                    complementGroups: {
                        // Grupo desativado não aparece (antes seguia no cardápio online e no PDV), 06/10/2026
                        where: { group: { active: true } },
                        select: {
                            order: true,
                            group: {
                                select: {
                                    id: true,
                                    name: true,
                                    min_quantity: true,
                                    max_quantity: true,
                                    free_quantity: true,
                                    options: {
                                        where: { active: true },
                                        select: {
                                            id: true,
                                            name: true,
                                            price: true,
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.payment.findMany({
                where: {
                    active: true,
                    // show_in_menu removed for compatibility
                },
                select: {
                    id: true,
                    name: true,
                    in_sight: true,
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.complementGroup.findMany({
                where: { active: true },
                select: {
                    id: true,
                    name: true,
                    min_quantity: true,
                    max_quantity: true,
                    free_quantity: true,
                    options: {
                        where: { active: true },
                        select: {
                            id: true,
                            name: true,
                            price: true,
                        },
                        orderBy: { name: 'asc' }
                    },
                    // Produtos ligados ao grupo, inclusive os fora do cardápio online: o PDV liga produto e grupo por aqui
                    products: {
                        select: {
                            product_id: true,
                            order: true,
                        }
                    }
                }
            }),
            prisma.subcategory.findMany({
                where: { active: true },
                include: {
                    category: true
                }
            })
        ])

        return reply.status(200).send({
            products: products.map(product => ({
                id: product.id,
                display_id: product.display_id,
                displayId: product.display_id,
                name: product.name,
                price: product.price,
                // O custo NÃO sai no cardápio público (é dado interno do cliente); o PDV pega em /api/pdv/sync/costs
                // Códigos fiscais limpos (ver lib/codigos-fiscais.ts): um valor fora do formato travava o PDV inteiro
                ...fiscaisLimpos(product),
                aliquota_pis: product.aliquota_pis,
                aliquota_cofins: product.aliquota_cofins,
                description: product.description,
                measureUnit: product.measureUnit,
                imageUrl: product.image_url
                    ? (product.image_url.startsWith('http')
                        ? product.image_url
                        : `${process.env.API_BASE_URL || 'https://api.metrics.dev.br'}${product.image_url.startsWith('/') ? '' : '/'}${product.image_url}`)
                    : null,
                is_priority: product.is_priority,
                category: product.category?.name || 'Geral',
                subcategory: product.subcategory ? {
                    id: product.subcategory.id,
                    name: product.subcategory.name,
                    accepts_fractions: product.subcategory.accepts_fractions,
                    max_fractions: product.subcategory.max_fractions,
                } : null,
                complementGroups: product.complementGroups.map(cg => ({
                    id: cg.group.id,
                    name: cg.group.name,
                    min_quantity: cg.group.min_quantity,
                    max_quantity: cg.group.max_quantity,
                    free_quantity: cg.group.free_quantity,
                    options: cg.group.options.map(opt => ({
                        id: opt.id,
                        name: opt.name,
                        price: opt.price,
                    }))
                }))
            })),
            complementGroups: complementGroups.map(cg => ({
                id: cg.id,
                name: cg.name,
                min_quantity: cg.min_quantity,
                max_quantity: cg.max_quantity,
                free_quantity: cg.free_quantity,
                options: cg.options.map(opt => ({
                    id: opt.id,
                    name: opt.name,
                    price: opt.price,
                })),
                products: cg.products.map(p => ({
                    product_id: p.product_id,
                    order: p.order,
                }))
            })),
            subcategories: subcategories.map(sub => ({
                id: sub.id,
                name: sub.name,
                category: sub.category.name,
                accepts_fractions: sub.accepts_fractions,
                max_fractions: sub.max_fractions,
            })),
            payments: payments.map(payment => ({
                id: payment.id,
                name: payment.name,
                in_sight: payment.in_sight,
            }))
        })
    } catch (error) {
        request.log.error(error)
        return reply.status(500).send({ message: 'Erro ao buscar dados do cardápio público.' })
    }
}
