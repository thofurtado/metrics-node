import { FastifyInstance } from 'fastify'
import { getProductsSync, getUsersSync, postStocksSync, getSyncStatus } from './pdv-sync-controller'

export async function pdvSyncRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        const apiKey = request.headers['x-api-key']
        // We're using the same or similar logic as we have in app.ts for pdv-sync
        const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
        if (apiKey !== validKey) {
            return reply.status(401).send({ message: 'Acesso não autorizado: Chave de API PDV inválida' })
        }
    })

    app.get('/api/pdv/sync/status', getSyncStatus)
    app.get('/api/pdv/status', getSyncStatus)

    app.get('/api/pdv/sync/products', getProductsSync)
    app.get('/api/pdv/sync/users', getUsersSync)
    app.post('/api/pdv/sync/stocks', postStocksSync)
    
    // Suporte também a rota sem /sync/ para bater com a chamada do App.xaml.cs, se for diferente
    app.get('/api/pdv/products', getProductsSync)
    app.get('/api/pdv/users', getUsersSync)
    app.post('/api/pdv/stocks', postStocksSync)
}
