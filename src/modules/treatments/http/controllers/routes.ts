import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createTreatment } from '@/modules/treatments/http/controllers/treatment'
import { createItemTreatment } from '@/modules/treatments/http/controllers/treatment-item'
import { getTreatments } from '@/modules/treatments/http/controllers/getTreatments'
import { RemoveTreatmentItem } from '@/modules/treatments/http/controllers/remove-treatment-item'
import { getTreatment } from '@/modules/treatments/http/controllers/getTreatment'
import { updateTreatment } from '@/modules/treatments/http/controllers/updateTreatment'
import { createInteraction } from '@/modules/treatments/http/controllers/interaction'
import { getServiceManagementData } from '@/modules/treatments/http/controllers/get-service-management-data'
import { finish } from '@/modules/treatments/http/controllers/finish'




export async function treatmentsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

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
