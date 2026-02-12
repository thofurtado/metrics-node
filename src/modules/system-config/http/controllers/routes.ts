
import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { getModulesStatus } from './get-modules-status'
import { updateModulesStatus } from './update-modules-status'

export async function systemConfigRoutes(app: FastifyInstance) {
    // Rotas públicas ou protegidas? Configurações geralmente são protegidas.
    // Vou assumir que precisa estar logado, talvez admin?
    // O usuário não especificou role, apenas "backend".
    // Vou usar verifyJwt por segurança.

    app.get(
        '/settings/modules',
        { onRequest: [verifyJwt] },
        getModulesStatus,
    )

    app.patch(
        '/settings/modules',
        { onRequest: [verifyJwt] },
        updateModulesStatus,
    )
}
