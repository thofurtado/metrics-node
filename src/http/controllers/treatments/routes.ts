import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createTreatment } from './treatment'
import { createItemTreatment } from './treatment-item'
import { getTreatment } from './getTreatments'
import { RemoveTreatmentItem } from './remove-treatment-item'




export async function treatmentsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)

    app.get('/treatments', getTreatment)
    app.post('/treatment', createTreatment)
    app.post('/treatment-item', createItemTreatment)
    app.delete('/treatment-item/:id', RemoveTreatmentItem)

}
