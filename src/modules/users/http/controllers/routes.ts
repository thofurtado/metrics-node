import { FastifyInstance } from 'fastify'
import { register } from '@/modules/users/http/controllers/register'
import { authenticate } from '@/modules/users/http/controllers/authenticate'
import { profile } from '@/modules/users/http/controllers/profile'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { refresh } from '@/modules/users/http/controllers/refresh'
import { updateProfile } from '@/modules/users/http/controllers/update-profile'


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
