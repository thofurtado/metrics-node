import fastify from 'fastify'
import { usersRoutes } from '@/modules/users/http/controllers/routes'
import { z, ZodError } from 'zod'
import i18next from 'i18next'
import { zodI18nMap } from 'zod-i18n-map'
import translation from 'zod-i18n-map/locales/pt/zod.json'

i18next.init({
    lng: "pt",
    resources: {
        pt: { zod: translation },
    },
});
z.setErrorMap(zodI18nMap);

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
import { kioskRoutes, hrAdminRoutes } from '@/modules/hr/http/controllers/routes'
import { systemConfigRoutes } from '@/modules/system-config/http/controllers/routes'
import { publicRoutes } from '@/modules/public/http/controllers/routes'
import { uploadsRoutes } from '@/modules/uploads/http/controllers/routes'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { truncate } from 'node:fs'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'

export const app = fastify({ logger: true })

app.register(fastifyMultipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
})

app.register(fastifyStatic, {
    root: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
})


app.register(cors, {
    // Allow all origins including 'null' (Electron file:// context sends null origin)
    origin: (origin, cb) => {
        // Accept any origin including null (Electron), file://, or any web origin
        cb(null, true)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true
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
app.register(publicRoutes)

// Quiosque (Electron / metrics-ponto) - autenticado via x-api-key
app.register(async (instance) => {
    instance.addHook('preHandler', async (request, reply) => {
        const apiKey = request.headers['x-api-key']
        const validKey = process.env.API_KEY_PONTO || 'metrics_secret_key_2026'
        if (apiKey !== validKey) {
            return reply.status(401).send({ message: 'Acesso não autorizado: Chave de API inválida' })
        }
    })
    instance.register(kioskRoutes)
})


// Admin HR (Painel Metrics) - autenticado via JWT
app.register(async (instance) => {
    instance.addHook('onRequest', verifyJwt)
    instance.register(hrAdminRoutes)
})

// Integração externa: Conferência de Caixa → Metrics (autenticação via API Key no próprio controller)
import { cashRegisterIntegration } from '@/modules/financial/http/controllers/cash-register-integration'
app.register(async (instance) => {
    instance.post('/integration/cash-register', cashRegisterIntegration)
})

app.register(uploadsRoutes)

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
        // Logging habilitado temporariamente para debugar o erro 500 em produção (Coolify)
        console.error('ERRO INTERNO (PROD):', error)
        //TODO: deveriamos fazer o logo para uma ferramenta externa como datadog/ new relic/sentry
    }
    return reply.status(500).send({ messagem: 'Erro interno do servidor', details: error.message })
})
