import { FastifyRequest, FastifyReply } from 'fastify'

export async function refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify({
            onlyCookie: true
        })
    } catch {
        // Fallback para clientes móveis ou chamadas enviando token de autorização
        await request.jwtVerify()
    }

    const { role } = request.user
    const tenantDomain = (request.user as any)?.tenantDomain

    // Preserva ou atualiza módulos do usuário
    let moduleNames: string[] = (request.user as any)?.modules || []
    try {
        const prisma = await import('@/lib/prisma').then(m => m.prisma)
        const userModules = await prisma.userModule.findMany({
            where: { user_id: request.user.sub },
            include: { module: true }
        })
        if (userModules.length > 0) {
            moduleNames = userModules.map(um => um.module.name)
        }
    } catch (e) {
        // fallback para os módulos já presentes no token
    }

    const token = await reply.jwtSign({
        role,
        modules: moduleNames,
        tenantDomain
    }, {
        sign: {
            sub: request.user.sub,
            expiresIn: '7d'
        }
    })

    const refreshToken = await reply.jwtSign({
        role,
        modules: moduleNames,
        tenantDomain
    }, {
        sign: {
            sub: request.user.sub,
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
}
