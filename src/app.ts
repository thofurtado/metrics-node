import fastify from 'fastify'
import { usersRoutes } from './http/controllers/users/routes'
import { ZodError } from 'zod'
import { env } from './env'
import fastifyJwt from '@fastify/jwt'
import { financialRoutes } from './http/controllers/financial/routes'
import { clientsRoutes } from './http/controllers/clients/routes'
import { itemsRoutes } from './http/controllers/items/routes'
import { treatmentsRoutes } from './http/controllers/treatments/routes'


export const app = fastify()

app.register(fastifyJwt, {
    secret: env.JWT_SECRET}
)

app.register(usersRoutes)
app.register(financialRoutes)
app.register(clientsRoutes)
app.register(itemsRoutes)
app.register(treatmentsRoutes)

app.setErrorHandler((error, _, reply) => {
    if(error instanceof ZodError) {
        return reply
            .status(400)
            .send({message: 'Erro de validação', issues: error.format()})
    }

    if(env.NODE_ENV !== 'production') {
        console.error(error)
    } else {
        //TODO: deveriamos fazer o logo para uma ferramenta externa como datadog/ new relic/sentry
    }
    return reply.status(500).send({messagem: 'Erro interno do servidor'})
})

