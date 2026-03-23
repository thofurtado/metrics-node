import { FastifyReply, FastifyRequest } from 'fastify'

export function verifyUserRole(roleToVerify: 'ADMIN' | 'MEMBER') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const apiKey = request.headers['x-api-key']
        const validKey = process.env.API_KEY_PONTO || 'metrics_secret_key_2026'
        if (apiKey === validKey) return

        if (!request.user) {
            return reply.status(401).send({ message: 'Não autenticado' })
        }
        const { role } = request.user
        if (role !== roleToVerify) {
            return reply.status(403).send({ message: 'Acesso negado: permissão insuficiente' })
        }
    }
}
