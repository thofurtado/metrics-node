import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import {
  createComplementGroup,
  fetchComplementGroups,
  updateComplementGroup,
  deleteComplementGroup,
  syncProductComplementGroups,
} from './complement-groups'

export async function complementsRoutes(app: FastifyInstance) {
  app.post('/complement-groups', { onRequest: [verifyJwt] }, createComplementGroup)
  app.get('/complement-groups', { onRequest: [verifyJwt] }, fetchComplementGroups)
  app.put('/complement-groups/:id', { onRequest: [verifyJwt] }, updateComplementGroup)
  app.delete('/complement-groups/:id', { onRequest: [verifyJwt] }, deleteComplementGroup)
  app.post('/products/:id/complement-groups', { onRequest: [verifyJwt] }, syncProductComplementGroups)
}
