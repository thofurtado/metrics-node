import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import {
  createSubcategory,
  fetchSubcategories,
  updateSubcategory,
  deleteSubcategory,
} from './subcategories'

export async function subcategoriesRoutes(app: FastifyInstance) {
  app.post('/subcategories', { onRequest: [verifyJwt] }, createSubcategory)
  app.get('/subcategories', { onRequest: [verifyJwt] }, fetchSubcategories)
  app.put('/subcategories/:id', { onRequest: [verifyJwt] }, updateSubcategory)
  app.delete('/subcategories/:id', { onRequest: [verifyJwt] }, deleteSubcategory)
}
