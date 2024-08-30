import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { MakeUpdateProfileUseCase } from '@/use-cases/factories/make-update-profile-use-case'




export async function updateProfile(request: FastifyRequest, reply: FastifyReply) {

    const updateProfileBodySchema = z.object({
        name: z.string().nullish(),
        password: z.string().min(6).nullish(),
        introduction: z.string().nullish(),
    })

    const {  name, password, introduction } = updateProfileBodySchema.parse(request.body)

    try {
        const updateProfileUseCase = MakeUpdateProfileUseCase()
        await updateProfileUseCase.execute({
            id: request.user.sub,
            name: name ? name : undefined,
            password: password ? password : undefined,
            introduction: introduction ? introduction : undefined,

        })
    } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
    return reply.status(200).send()
}


