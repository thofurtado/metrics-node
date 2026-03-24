import { makeGetUserProfileUseCase } from '@/modules/users/use-cases/factories/make-get-user-profile-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function profile(request: FastifyRequest, reply: FastifyReply) {
    try {
        const getUserProfile = makeGetUserProfileUseCase()

        const { user } = await getUserProfile.execute({
            userId: request.user.sub
        })

        // Busca os módulos do usuário SEMPRE do banco — nunca do JWT stale
        const userModules = await prisma.userModule.findMany({
            where: { user_id: user.id },
            include: { module: { select: { slug: true } } }
        })
        const modules = userModules.map(um => um.module.slug)

        return reply.status(200).send({
            user: {
                ...user,
                password_hash: undefined,
                modules, // ex: ["finance", "hr"]
            }
        })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(401).send({ message: 'User not found' })
        }

        throw err
    }
}


