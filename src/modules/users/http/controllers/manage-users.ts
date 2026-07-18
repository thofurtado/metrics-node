import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

export async function createUser(request: FastifyRequest, reply: FastifyReply) {
    const createUserBodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
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
            role,
            userModules: {
                create: moduleIds.map(moduleId => ({
                    module_id: moduleId
                }))
            }
        },
    })

    return reply.status(201).send({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

export async function updateUser(request: FastifyRequest, reply: FastifyReply) {
    const updateUserParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateUserBodySchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(['ADMIN', 'MEMBER']).optional(),
        modules: z.array(z.string()).optional(),
    })

    const { id } = updateUserParamsSchema.parse(request.params)
    const { name, email, password, role, modules } = updateUserBodySchema.parse(request.body)

    // Impede auto-remoção de privilégios ou settings, se necessário
    // Por simplicidade, vamos permitir atualizar, mas garantir que email não duplique
    if (email) {
        const userWithSameEmail = await prisma.user.findUnique({ where: { email } })
        if (userWithSameEmail && userWithSameEmail.id !== id) {
            return reply.status(409).send({ message: 'E-mail já está em uso por outro usuário.' })
        }
    }

    let password_hash
    if (password) {
        password_hash = await hash(password, 6)
    }

    const updateData: any = {
        name,
        email,
        role,
    }
    if (password_hash) {
        updateData.password_hash = password_hash
    }

    // Se módulos foram fornecidos, atualizamos eles também em uma transaction
    try {
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: updateData,
            })

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
    } catch (e: any) {
        return reply.status(500).send({ message: 'Erro ao atualizar usuário.', details: e.message })
    }

    return reply.status(204).send()
}

export async function deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const deleteUserParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteUserParamsSchema.parse(request.params)

    // Proteção básica: não deletar a si mesmo
    if (request.user && request.user.sub === id) {
        return reply.status(400).send({ message: 'Você não pode excluir a sua própria conta.' })
    }

    try {
        await prisma.user.delete({
            where: { id }
        })
    } catch (e: any) {
        return reply.status(500).send({ message: 'Erro ao excluir usuário.', details: e.message })
    }

    return reply.status(204).send()
}
