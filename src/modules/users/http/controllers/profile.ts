import { makeGetUserProfileUseCase } from '@/modules/users/use-cases/factories/make-get-user-profile-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'

import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function profile(request: FastifyRequest, reply: FastifyReply) {
    try {
        const getUserProfile = makeGetUserProfileUseCase()

        const { user } = await getUserProfile.execute({
            userId: request.user.sub
        })

        return reply.status(200).send({
            user: {
                ...user,
                password_hash: undefined
            }
        })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(401).send({ message: 'User not found' })
        }

        throw err
    }
}


