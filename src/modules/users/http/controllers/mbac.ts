import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function fetchAllModules(request: FastifyRequest, reply: FastifyReply) {
    const modules = await prisma.module.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
        }
    })
    return reply.status(200).send({ modules })
}

export async function fetchUsersWithModules(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            userModules: {
                select: {
                    module: {
                        select: {
                            name: true,
                            id: true
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    const formattedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        modules: user.userModules.map(um => um.module.slug)
    }))

    return reply.status(200).send({ users: formattedUsers })
}

export async function updateUserModules(request: FastifyRequest, reply: FastifyReply) {
    console.log("➡️ [MBAC] PUT /users/:id/modules received:", { params: request.params, body: request.body })
    
    const updateUserModulesParams = z.object({
        id: z.string().uuid()
    })
    const updateUserModulesBody = z.object({
        modules: z.array(z.string())
    })

    let id: string;
    let modules: string[];

    try {
        const parsedParams = updateUserModulesParams.parse(request.params)
        const parsedBody = updateUserModulesBody.parse(request.body)
        id = parsedParams.id
        modules = parsedBody.modules
    } catch (e: any) {
        console.error("❌ [MBAC] Validation Error:", e)
        return reply.status(400).send({ 
            message: "Payload inválido. Verifique os dados enviados.", 
            errors: e?.errors 
        })
    }

    // Security Lock-Out check
    if (request.user && id === request.user.sub && !modules.includes('settings')) {
        return reply.status(400).send({
            message: 'Acesso Negado: Você não pode remover sua própria permissão de Configurações.'
        })
    }

    // Resolving module IDs from slugs
    const dbModules = await prisma.module.findMany({
        where: { slug: { in: modules } }
    })

    const moduleIds = dbModules.map(m => m.id)

    // Run transaction: delete all current modules for user, insert new ones
    await prisma.$transaction([
        prisma.userModule.deleteMany({
            where: { user_id: id }
        }),
        prisma.userModule.createMany({
            data: moduleIds.map(moduleId => ({
                user_id: id,
                module_id: moduleId
            }))
        })
    ])

    return reply.status(204).send()
}
