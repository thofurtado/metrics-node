import { FastifyReply, FastifyRequest } from 'fastify'

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers['x-api-key']
    const validKey = process.env.API_KEY_PONTO || 'metrics_secret_key_2026'

    if (apiKey === validKey) {
        return
    }

    try {
        await request.jwtVerify()
    } catch (err) {
        return reply.status(401).send({ message: 'Desautorizado' })
    }
}
