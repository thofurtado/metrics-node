import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { getModulesStatus } from './get-modules-status'
import { updateModulesStatus } from './update-modules-status'

export async function systemConfigRoutes(app: FastifyInstance) {
    // Leitura das configurações dos módulos ativados no sistema (pública)
    app.get('/settings/modules', getModulesStatus)

    // Atualização das configurações dos módulos (protegida para administradores)
    app.patch(
        '/settings/modules',
        { onRequest: [verifyJwt] },
        updateModulesStatus,
    )
}
