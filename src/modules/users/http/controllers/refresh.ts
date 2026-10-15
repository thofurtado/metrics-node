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

    const tenantDomain = (request.user as any)?.tenantDomain
    const prisma = await import('@/lib/prisma').then(m => m.prisma)

    // Fase 4 do Mergulho (17:U6): a web passou a renovar o token sozinha antes de vencer (sessão que não cai enquanto o
    // usuário usa). Por isso o papel vem do BANCO, não do token antigo: senão um administrador rebaixado continuaria
    // ADMIN para sempre só renovando. Usuário apagado não renova.
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { role: true } })
    if (!user) {
        return reply.status(401).send({ message: 'Usuário não encontrado. Entre de novo.' })
    }
    const role = user.role

    // Preserva ou atualiza módulos do usuário
    let moduleNames: string[] = (request.user as any)?.modules || []
    try {
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
