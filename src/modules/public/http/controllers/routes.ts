import { FastifyInstance } from 'fastify'
import { getMenu } from './get-menu'

export async function publicRoutes(app: FastifyInstance) {
    app.get('/public/menu', getMenu)
}
