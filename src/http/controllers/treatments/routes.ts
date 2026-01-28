import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createTreatment } from './treatment'
import { createItemTreatment } from './treatment-item'
import { getTreatments } from './getTreatments'
import { RemoveTreatmentItem } from './remove-treatment-item'
import { getTreatment } from './getTreatment'
import { updateTreatment } from './updateTreatment'
import { createInteraction } from './interaction'
import { getServiceManagementData } from './get-service-management-data'
import { finish } from './finish'




export async function treatmentsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)

    app.get('/treatments', getTreatments)
    app.get('/treatment/:id', getTreatment)
    app.patch('/treatment/:id', updateTreatment)
    app.post('/treatment/:id/interaction', createInteraction)
    app.post('/treatment', createTreatment)
    app.post('/treatment-item', createItemTreatment)
    app.delete('/treatment-item/:id', RemoveTreatmentItem)
    app.patch('/treatment/:id/finish', finish)
    app.get('/service-management', getServiceManagementData)
}
