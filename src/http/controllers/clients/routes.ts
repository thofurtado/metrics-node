import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createClient } from './client'
import { createEquipment } from './equipment'
import { createAddress } from './address'
import { getClient } from './getClients'


export async function clientsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)


    app.post('/client', createClient)
    app.post('/equipment', createEquipment)
    app.post('/address', createAddress)
    app.get('/clients', getClient)
}
