import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyModuleAccess, verifyModuleAccessPainel } from '@/http/middlewares/verify-module-access'
import { createTreatment } from '@/modules/treatments/http/controllers/treatment'
import { createItemTreatment } from '@/modules/treatments/http/controllers/treatment-item'
import { getTreatments } from '@/modules/treatments/http/controllers/getTreatments'
import { RemoveTreatmentItem } from '@/modules/treatments/http/controllers/remove-treatment-item'
import { getTreatment } from '@/modules/treatments/http/controllers/getTreatment'
import { updateTreatment } from '@/modules/treatments/http/controllers/updateTreatment'
import { createInteraction } from '@/modules/treatments/http/controllers/interaction'
import { getServiceManagementData } from '@/modules/treatments/http/controllers/get-service-management-data'
import { finish } from '@/modules/treatments/http/controllers/finish'
import { reopen } from '@/modules/treatments/http/controllers/reopen'




// Fase 0 do Mergulho (17:U1): trava do módulo Atendimento. /service-management é da tela inicial do app Gerencial e só
// trava com TRAVA_MODULO_PAINEL=1 (ver verifyModuleAccessPainel).
const travaAtendimento = verifyModuleAccess('service')
const travaPainelAtendimento = verifyModuleAccessPainel('service')

export async function treatmentsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)
    app.addHook('onRequest', async (request, reply) => {
        if (request.routeOptions.url === '/service-management') return travaPainelAtendimento(request, reply)
        return travaAtendimento(request, reply)
    })

    app.get('/treatments', getTreatments)
    app.get('/treatment/:id', getTreatment)
    app.patch('/treatment/:id', updateTreatment)
    app.post('/treatment/:id/interaction', createInteraction)
    app.post('/treatment', createTreatment)
    app.post('/treatment-item', createItemTreatment)
    app.delete('/treatment-item/:id', RemoveTreatmentItem)
    app.patch('/treatment/:id/finish', finish)
    app.patch('/treatment/:id/reopen', reopen)
    app.get('/service-management', getServiceManagementData)
}
