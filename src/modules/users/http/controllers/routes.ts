import { FastifyInstance } from 'fastify'
import { register } from '@/modules/users/http/controllers/register'
import { authenticate } from '@/modules/users/http/controllers/authenticate'
import { profile } from '@/modules/users/http/controllers/profile'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyUserRole } from '@/http/middlewares/verify-user-role'
import { refresh } from '@/modules/users/http/controllers/refresh'
import { updateProfile } from '@/modules/users/http/controllers/update-profile'
import { getPublicUsers } from '@/modules/users/http/controllers/get-public-users'
import { fetchAllModules, fetchUsersWithModules, updateUserModules } from '@/modules/users/http/controllers/mbac'
import { createUser, updateUser, deleteUser } from '@/modules/users/http/controllers/manage-users'

// Fase 0 do Mergulho (achados 17:U10, 17:U1, 17:U7): só o usuário logado dava para ler e mexer em tudo.
// Agora: o cadastro público (POST /users) e a gestão de usuários e módulos exigem papel ADMIN de verdade.
// A loja nova continua nascendo pelo SaaS Admin (provisionamento + seed), não por esta rota.
const SOMENTE_ADMIN = { onRequest: [verifyJwt, verifyUserRole('ADMIN')] }

export async function usersRoutes(app: FastifyInstance) {
    // Rota pública para listar usuários no select de login
    app.get('/users/public', getPublicUsers)

    // Criar usuário: era cadastro público (qualquer um virava usuário da loja). Agora só ADMIN.
    app.post('/users', SOMENTE_ADMIN, register)
    //criando sessão
    app.post('/sessions', authenticate)

    app.patch('/token/refresh', refresh)
    //** Authenticated  */
    app.get('/me', { onRequest: [verifyJwt] }, profile)

    app.put('/profile', { onRequest: [verifyJwt] }, updateProfile)

    // Módulos e permissões: só ADMIN lê e muda (a tela de permissões já é só de admin na web).
    app.get('/modules', SOMENTE_ADMIN, fetchAllModules)
    app.get('/users-with-modules', SOMENTE_ADMIN, fetchUsersWithModules)
    app.put('/users/:id/modules', SOMENTE_ADMIN, updateUserModules)

    // CRUD de Usuários: só ADMIN cria, edita e apaga.
    app.post('/admin/users', SOMENTE_ADMIN, createUser)
    app.put('/admin/users/:id', SOMENTE_ADMIN, updateUser)
    app.delete('/admin/users/:id', SOMENTE_ADMIN, deleteUser)

    // ✅ Solução Fastify
    app.get('/health', async (request, reply) => {

        reply.status(200).send({ status: 'ok' });

    });
}
