import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createClient } from '@/modules/clients/http/controllers/client'
import { createEquipment } from '@/modules/clients/http/controllers/equipment'
import { createAddress } from '@/modules/clients/http/controllers/address'
import { getClient } from '@/modules/clients/http/controllers/getClients'


export async function clientsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)


    app.post('/client', createClient)
    app.post('/equipment', createEquipment)
    app.post('/address', createAddress)
    app.get('/clients', getClient)
}
