import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyUserRole } from '@/http/middlewares/verify-user-role'
import { getVpnNetworks } from './vpn-noc'

// Fase 0 do Mergulho (achado 19:V5): a rota devolve as chaves de entrada da VPN das lojas; antes bastava
// estar logado. Agora exige papel ADMIN.
export async function vpnRoutes(app: FastifyInstance) {
    app.get('/vpn/networks', { onRequest: [verifyJwt, verifyUserRole('ADMIN')] }, getVpnNetworks)
}
