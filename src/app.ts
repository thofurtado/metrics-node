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
import { telemetryRoutes, adminEquipmentsRoutes } from '@/modules/equipments/http/controllers/routes'
import { systemConfigRoutes } from '@/modules/system-config/http/controllers/routes'
import { publicRoutes } from '@/modules/public/http/controllers/routes'
import { uploadsRoutes } from '@/modules/uploads/http/controllers/routes'
import { salesRoutes } from '@/modules/sales/http/controllers/routes'
import { pdvSyncRoutes } from '@/modules/pdv-sync/http/controllers/routes'
import { printDepartmentsRoutes } from '@/modules/print-departments/http/controllers/routes'
import { cashierRoutes } from '@/modules/cashier/http/controllers/routes'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { truncate } from 'node:fs'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'

import { fastifyRequestContext, requestContext } from '@fastify/request-context'
import { getPrismaForDomain, getDbNameForDomain } from '@/lib/tenant-manager'

export const app = fastify({ logger: true })

app.register(fastifyRequestContext)

app.addHook('onRequest', async (request, reply) => {
    // Ignora a verificaÃ§Ã£o de tenant para rotas de health check, provisionamento e OPTIONS (Preflight do CORS)
    // TambÃ©m ignora arquivos estÃ¡ticos da pasta de uploads apenas para requisiÃ§Ãµes GET
    if (
        request.method === 'OPTIONS' || 
        request.url === '/public/health' || 
        request.url.startsWith('/public/provision') || 
        request.url === '/public/db-status' ||
        request.url === '/public/db-sync' ||
        request.url === '/' ||
        (request.method === 'GET' && request.url.startsWith('/uploads/') && request.url.match(/\.(jpg|jpeg|png|gif|webp|pdf|csv|txt|doc|docx)$/i))
    ) {
        return;
    }

    // 1. Identificar o domÃ­nio pelo qual a API foi chamada (Host header)
    let domain = request.hostname;
    
    // 2. Fallback para desenvolvimento local ou testes via header manual
    if (request.headers['x-tenant-domain']) {
        domain = request.headers['x-tenant-domain'] as string;
    }

    // Remove porta se houver (ex: localhost:3333 -> localhost)
    domain = domain.split(':')[0];

    // Remove o 'www.' e 'api.' para garantir que as requisiÃ§Ãµes encontrem o cliente base
    domain = domain.replace(/^www\./, '');
    domain = domain.replace(/^api\./, '');

    // 3. Busca a conexÃ£o do Prisma no TenantManager
    const tenantPrisma = await getPrismaForDomain(domain);
    const tenantDbName = await getDbNameForDomain(domain);
    
    if (!tenantPrisma || !tenantDbName) {
        return reply.status(403).send({ message: `Acesso Negado: Cliente nÃ£o reconhecido ou inativo para o domÃ­nio (${domain}).` });
    }

    // 4. Injeta a conexÃ£o Prisma e o nome real do Tenant perfeitamente isolados no contexto atual
    requestContext.set('prisma', tenantPrisma);
    requestContext.set('tenant', tenantDbName);
})

app.register(fastifyMultipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
})

app.register(fastifyStatic, {
    root: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    redirect: false, // Prevents 301 redirects to trailing slashes on directories which drop auth headers on POST
})


app.register(cors, {
    // Allow all origins including 'null' (Electron file:// context sends null origin)
    origin: (origin, cb) => {
        // Accept any origin including null (Electron), file://, or any web origin
        cb(null, true)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-tenant-domain'],
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
app.register(salesRoutes)
app.register(pdvSyncRoutes)
app.register(printDepartmentsRoutes)
app.register(cashierRoutes)
// Quiosque (Electron / metrics-ponto) - autenticado via x-api-key
app.register(async (instance) => {
    instance.addHook('preHandler', async (request, reply) => {
        const apiKey = request.headers['x-api-key']
        const validKey = process.env.API_KEY_PONTO || 'metrics_secret_key_2026'
        if (apiKey !== validKey) {
            return reply.status(401).send({ message: 'Acesso nÃ£o autorizado: Chave de API invÃ¡lida' })
        }
    })
    instance.register(kioskRoutes)
    instance.register(telemetryRoutes)
})


// Admin HR (Painel Metrics) - autenticado via JWT
app.register(async (instance) => {
    instance.addHook('onRequest', verifyJwt)
    instance.register(hrAdminRoutes)
    instance.register(adminEquipmentsRoutes)
})

// IntegraÃ§Ã£o externa: ConferÃªncia de Caixa â†’ Metrics (autenticaÃ§Ã£o via API Key no prÃ³prio controller)
import { cashRegisterIntegration } from '@/modules/financial/http/controllers/cash-register-integration'
app.register(async (instance) => {
    instance.post('/integration/cash-register', cashRegisterIntegration)
})

app.register(uploadsRoutes)

app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
        return reply
            .status(400)
            .send({ message: 'Erro de validaÃ§Ã£o', issues: error.format() })
    }

    if (error instanceof ResourceNotFoundError) {
        return reply.status(404).send({ message: 'Recurso nÃ£o encontrado' })
    }

    if (env.NODE_ENV !== 'production') {
        console.error(error)
    } else {
        // Logging habilitado temporariamente para debugar o erro 500 em produÃ§Ã£o (Coolify)
        console.error('ERRO INTERNO (PROD):', error)
        //TODO: deveriamos fazer o logo para uma ferramenta externa como datadog/ new relic/sentry
    }
    return reply.status(500).send({ messagem: 'Erro interno do servidor', details: error.message })
})


