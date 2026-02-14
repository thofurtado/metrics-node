import fastify from 'fastify'
import { usersRoutes } from '@/modules/users/http/controllers/routes'
import { ZodError } from 'zod'
import { env } from '@/env/index'
import fastifyJwt from '@fastify/jwt'
import { financialRoutes } from '@/modules/financial/http/controllers/routes'
import { clientsRoutes } from '@/modules/clients/http/controllers/routes'
import { itemsRoutes } from '@/modules/items/http/controllers/routes'
import { treatmentsRoutes } from '@/modules/treatments/http/controllers/routes'
import fastifyCookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { metricsRoutes } from '@/modules/metrics/http/controllers/routes'
import { productsRoutes } from '@/modules/products/http/controllers/routes'
import { servicesRoutes } from '@/modules/services/http/controllers/routes'
import { suppliesRoutes } from '@/modules/supplies/http/controllers/routes'
import { categoriesRoutes } from '@/modules/categories/http/controllers/routes'
import { suppliersRoutes } from '@/modules/suppliers/http/controllers/routes'
import { systemConfigRoutes } from '@/modules/system-config/http/controllers/routes'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export const app = fastify({ logger: true })
// [
//         'http://localhost:5173',
//         'http://192.168.1.2:5173',
//         'https://www.eurecatech.com.br',
//         'https://metrics-sigma.vercel.app',
//     ],

app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ← ADD ESTA LINHA
    credentials: true // ← importante para cookies/tokens
})
app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
        cookieName: 'refreshToken',
        signed: false
    },
    sign: {
        expiresIn: '10d',
    }
}
)
app.register(fastifyCookie)

app.register(usersRoutes)
app.register(financialRoutes)
app.register(clientsRoutes)
app.register(itemsRoutes)
app.register(treatmentsRoutes)
app.register(metricsRoutes)
app.register(productsRoutes)
app.register(servicesRoutes)
app.register(suppliesRoutes)
app.register(categoriesRoutes)
app.register(suppliersRoutes)
app.register(systemConfigRoutes)

app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
        return reply
            .status(400)
            .send({ message: 'Erro de validação', issues: error.format() })
    }

    if (error instanceof ResourceNotFoundError) {
        return reply.status(404).send({ message: 'Recurso não encontrado' })
    }

    if (env.NODE_ENV !== 'production') {
        console.error(error)
    } else {
        //TODO: deveriamos fazer o logo para uma ferramenta externa como datadog/ new relic/sentry
    }
    return reply.status(500).send({ messagem: 'Erro interno do servidor' })
})
