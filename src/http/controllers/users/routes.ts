import { FastifyInstance } from 'fastify'
import { register } from '@/http/controllers/users/register'
import { authenticate } from '@/http/controllers/users/authenticate'
import { profile } from '@/http/controllers/users/profile'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { refresh } from './refresh'
import { updateProfile } from './update-profile'


export async function usersRoutes(app: FastifyInstance) {
    //criando usuário
    app.post('/users', register)
    //criando sessão
    app.post('/sessions', authenticate)

    app.patch('/token/refresh', refresh)
    //** Authenticated  */
    app.get('/me', { onRequest: [verifyJwt] }, profile)

    app.put('/profile', { onRequest: [verifyJwt] }, updateProfile)

    // ✅ Solução Fastify
    app.get('/health', async (request, reply) => {

        reply.status(200).send({ status: 'ok' });

    });
}
