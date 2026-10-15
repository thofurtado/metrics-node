import { FastifyInstance } from 'fastify'

import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createClient } from '@/modules/clients/http/controllers/client'
import { createEquipment } from '@/modules/clients/http/controllers/equipment'
import { createAddress } from '@/modules/clients/http/controllers/address'
import { getClient } from '@/modules/clients/http/controllers/getClients'
import { updateClient, deleteClient } from '@/modules/clients/http/controllers/update-client'
import {
  listClientGroups,
  createClientGroup,
  updateClientGroup,
  deleteClientGroup,
} from '@/modules/clients/http/controllers/client-groups'

export async function clientsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/client', createClient)
    app.post('/equipment', createEquipment)
    app.post('/address', createAddress)
    app.get('/clients', getClient)
    // Fase 4 do Mergulho (16:A7): corrigir e excluir (sem histórico) o cadastro do cliente
    app.put('/client/:id', updateClient)
    app.delete('/client/:id', deleteClient)

    // Gestão de Grupos de Clientes / Multi-Lojas
    app.get('/client-groups', listClientGroups)
    app.post('/client-groups', createClientGroup)
    app.put('/client-groups/:id', updateClientGroup)
    app.delete('/client-groups/:id', deleteClientGroup)
}
