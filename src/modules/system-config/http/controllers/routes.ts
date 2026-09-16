import { getIntegrationsConfig, updateIntegrationsConfig } from './integrations-config'
import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { getModulesStatus } from './get-modules-status'
import { updateModulesStatus } from './update-modules-status'
import { updateCompanyProfile } from './update-company-profile'

export async function systemConfigRoutes(app: FastifyInstance) {
    // Configurações de Integrações & APIs
    app.get('/settings/integrations', { onRequest: [verifyJwt] }, getIntegrationsConfig)
    app.patch('/settings/integrations', { onRequest: [verifyJwt] }, updateIntegrationsConfig)

    // Leitura das configurações dos módulos ativados no sistema (pública)
    app.get('/settings/modules', getModulesStatus)

    // Atualização das configurações dos módulos (protegida para administradores)
    app.patch(
        '/settings/modules',
        { onRequest: [verifyJwt] },
        updateModulesStatus,
    )

    // Atualização do Perfil da Empresa (Cardápio / White label)
    app.put(
        '/settings/company-profile',
        { onRequest: [verifyJwt] },
        updateCompanyProfile,
    )
}
