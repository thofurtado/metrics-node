import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createTreatment } from './treatment'
import { createItemTreatment } from './item-treatment'




export async function treatmentsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)


    app.post('/treatment', createTreatment)
    app.post('/treatment-item', createItemTreatment)


}
