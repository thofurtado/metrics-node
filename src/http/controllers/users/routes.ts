import { FastifyInstance } from 'fastify'
import { register } from '@/http/controllers/users/register'
import { authenticate } from '@/http/controllers/users/authenticate'
import { profile } from '@/http/controllers/users/profile'
import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { refresh } from './refresh'


export async function usersRoutes(app: FastifyInstance) {
    //criando usuário
    app.post('/users', register)
    //criando sessão
    app.post('/sessions', authenticate)

    app.patch('/token/refresh', refresh)
    //** Authenticated  */
    app.get('/me', {onRequest: [verifyJWT]} ,profile)
}
