import { FastifyInstance } from 'fastify'
import { fetch, create, remove, updateProducts } from './department.controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function printDepartmentsRoutes(app: FastifyInstance) {
    app.get('/print-departments', { onRequest: [verifyJwt] }, fetch)
    app.post('/print-departments', { onRequest: [verifyJwt] }, create)
    app.delete('/print-departments/:id', { onRequest: [verifyJwt] }, remove)
    app.post('/print-departments/:id/products', { onRequest: [verifyJwt] }, updateProducts)
}
