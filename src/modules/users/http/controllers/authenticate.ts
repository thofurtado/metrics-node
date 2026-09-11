import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { InvalidCredentialsError } from '@/errors/invalid-credentials-error'
import { makeAuthenticateUseCase } from '@/modules/users/use-cases/factories/make-authenticate-use-case'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authenticateBodySchema = z.object({
        userId: z.string().uuid().optional(),
        email: z.string().email().optional(),
        password: z.string().optional(),
        pin: z.string().optional(),
    }).refine((data) => data.userId || data.email, {
        message: 'Informe o usuário ou e-mail.'
    }).refine((data) => (data.password && data.password.trim().length > 0) || (data.pin && data.pin.trim().length > 0), {
        message: 'Informe a senha ou PIN de acesso.'
    })

    const { userId, email, password, pin } = authenticateBodySchema.parse(request.body)

    try {
        const authenticateUseCase = makeAuthenticateUseCase()
        const { user } = await authenticateUseCase.execute({
            userId,
            email,
            password,
            pin,
        })
        // Fetch the user modules from the database
        const prisma = await import('@/lib/prisma').then(m => m.prisma)
        const userModules = await prisma.userModule.findMany({
            where: { user_id: user.id },
            include: { module: true }
        })
        const moduleNames = userModules.map(um => um.module.name)

        const token = await reply.jwtSign({
            role: user.role,
            modules: moduleNames
        }, {
            sign: {
                sub: user.id,
                expiresIn: '7d'
            }
        })
        const refreshToken = await reply.jwtSign({
            role: user.role,
            modules: moduleNames
        }, {
            sign: {
                sub: user.id,
                expiresIn: '7d'
            }
        })

        return reply
            .setCookie('refreshToken', refreshToken, {
                path: '/',
                secure: true,
                sameSite: true,
                httpOnly: true
            })
            .status(200)
            .send({ token, refreshToken })
    } catch (err) {
        if (err instanceof InvalidCredentialsError) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }

}


