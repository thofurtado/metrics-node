import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma as defaultPrisma } from '@/lib/prisma'
import { requestContext } from '@fastify/request-context'
import { hash } from 'bcryptjs'

function getPrisma() {
    return requestContext.get('prisma') || defaultPrisma
}

export async function createUser(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getPrisma()

    const createUserBodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['ADMIN', 'MEMBER', 'TECHNICIAN', 'CASHIER']).default('MEMBER'),
        modules: z.array(z.string()).default([]),
    })

    const { name, email, password, role, modules } = createUserBodySchema.parse(request.body)

    const userWithSameEmail = await prisma.user.findUnique({
        where: { email },
    })

    if (userWithSameEmail) {
        return reply.status(409).send({ message: 'E-mail já está em uso.' })
    }

    const password_hash = await hash(password, 6)

    // Converte MEMBER -> TECHNICIAN se necessário
    const dbRole = (role === 'MEMBER' ? 'TECHNICIAN' : role) as 'ADMIN' | 'TECHNICIAN' | 'CASHIER'

    // Primeiro resolvemos os IDs dos módulos baseados nos slugs
    let moduleIds: string[] = []
    if (modules.length > 0) {
        const dbModules = await prisma.module.findMany({
            where: { slug: { in: modules } },
            select: { id: true }
        })
        moduleIds = dbModules.map(m => m.id)
    }

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password_hash,
            role: dbRole,
            modules: {
                create: moduleIds.map((moduleId) => ({
                    module: {
                        connect: { id: moduleId },
                    },
                })),
            }
        },
    })

    return reply.status(201).send({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

export async function updateUser(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getPrisma()

    const updateUserParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateUserBodySchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional().nullable().or(z.literal('')),
        role: z.enum(['ADMIN', 'MEMBER', 'TECHNICIAN', 'CASHIER', 'admin', 'member', 'technician', 'cashier']).optional(),
        modules: z.array(z.string()).optional(),
    })

    const { id } = updateUserParamsSchema.parse(request.params)
    const { name, email, password, role, modules } = updateUserBodySchema.parse(request.body)

    if (email) {
        const userWithSameEmail = await prisma.user.findUnique({ where: { email } })
        if (userWithSameEmail && userWithSameEmail.id !== id) {
            return reply.status(409).send({ message: 'E-mail já está em uso por outro usuário.' })
        }
    }

    let password_hash: string | undefined
    if (password && password.trim().length >= 6) {
        password_hash = await hash(password.trim(), 6)
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (role) {
        const upperRole = role.toUpperCase()
        updateData.role = upperRole === 'MEMBER' ? 'TECHNICIAN' : upperRole
    }
    if (password_hash) {
        updateData.password_hash = password_hash
    }

    try {
        await prisma.$transaction(async (tx) => {
            if (Object.keys(updateData).length > 0) {
                await tx.user.update({
                    where: { id },
                    data: updateData,
                })
            }

            if (modules !== undefined) {
                // Remove atuais
                await tx.userModule.deleteMany({
                    where: { user_id: id }
                })

                if (modules.length > 0) {
                    const dbModules = await tx.module.findMany({
                        where: { slug: { in: modules } },
                        select: { id: true }
                    })

                    await tx.userModule.createMany({
                        data: dbModules.map(m => ({
                            user_id: id,
                            module_id: m.id
                        }))
                    })
                }
            }
        })

        const updatedUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, role: true }
        })

        return reply.send({ user: updatedUser })
    } catch (err) {
        console.error(err)
        return reply.status(500).send({ message: 'Erro interno ao atualizar usuário.' })
    }
}

export async function deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getPrisma()

    const deleteUserParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteUserParamsSchema.parse(request.params)

    const user = await prisma.user.findUnique({
        where: { id },
    })

    if (!user) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' })
    }

    await prisma.user.delete({
        where: { id },
    })

    return reply.status(204).send()
}
