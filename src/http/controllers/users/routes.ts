import { FastifyInstance } from 'fastify'
import { register } from '@/http/controllers/users/register'
import { authenticate } from '@/http/controllers/users/authenticate'
import { profile } from '@/http/controllers/users/profile'
import { verifyJWT } from '@/http/middlewares/verify-jwt'


export async function usersRoutes(app: FastifyInstance) {
    //criando usuário
    app.post('/users', register)
    //criando sessão
    app.post('/sessions', authenticate)


    //** Authenticated  */
    app.get('/me', {onRequest: [verifyJWT]} ,profile)
}
