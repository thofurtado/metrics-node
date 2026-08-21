import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { getVpnNetworks } from './vpn-noc'

export async function vpnRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)
    app.get('/vpn/networks', getVpnNetworks)
}
