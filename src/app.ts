import fastify from 'fastify'
import { usersRoutes } from './http/controllers/users/routes'
import { ZodError } from 'zod'
import { env } from './env'
import fastifyJwt from '@fastify/jwt'
import { financialRoutes } from './http/controllers/financial/routes'
import { clientsRoutes } from './http/controllers/clients/routes'
import { itemsRoutes } from './http/controllers/items/routes'
import { treatmentsRoutes } from './http/controllers/treatments/routes'
import fastifyCookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { metricsRoutes } from './http/controllers/metrics/routes'
import { productsRoutes } from './http/controllers/products/routes'
import { servicesRoutes } from './http/controllers/services/routes'
import { suppliesRoutes } from './http/controllers/supplies/routes'
import { categoriesRoutes } from './http/controllers/categories/routes'
import { suppliersRoutes } from './http/controllers/suppliers/routes'

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

app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
        return reply
            .status(400)
            .send({ message: 'Erro de validação', issues: error.format() })
    }

    if (env.NODE_ENV !== 'production') {
        console.error(error)
    } else {
        //TODO: deveriamos fazer o logo para uma ferramenta externa como datadog/ new relic/sentry
    }
    return reply.status(500).send({ messagem: 'Erro interno do servidor' })
})

