import { FastifyInstance } from 'fastify'
import { register } from '@/modules/users/http/controllers/register'
import { authenticate } from '@/modules/users/http/controllers/authenticate'
import { profile } from '@/modules/users/http/controllers/profile'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { refresh } from '@/modules/users/http/controllers/refresh'
import { updateProfile } from '@/modules/users/http/controllers/update-profile'
import { getPublicUsers } from '@/modules/users/http/controllers/get-public-users'
import { fetchAllModules, fetchUsersWithModules, updateUserModules } from '@/modules/users/http/controllers/mbac'


export async function usersRoutes(app: FastifyInstance) {
    // Rota pública para listar usuários no select de login
    app.get('/users/public', getPublicUsers)

    //criando usuário
    app.post('/users', register)
    //criando sessão
    app.post('/sessions', authenticate)

    app.patch('/token/refresh', refresh)
    //** Authenticated  */
    app.get('/me', { onRequest: [verifyJwt] }, profile)

    app.put('/profile', { onRequest: [verifyJwt] }, updateProfile)

    // Rotas protegidas (geralmente sob verifyJwt ou verifyModuleAccess)
    app.get('/modules', { onRequest: [verifyJwt] }, fetchAllModules)
    app.get('/users-with-modules', { onRequest: [verifyJwt] }, fetchUsersWithModules)
    app.put('/users/:id/modules', { onRequest: [verifyJwt] }, updateUserModules)

    // ✅ Solução Fastify
    app.get('/health', async (request, reply) => {

        reply.status(200).send({ status: 'ok' });

    });
}
