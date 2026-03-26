import { getOperationalSummary } from './src/modules/financial/http/controllers/get-operational-summary'
import fastify from 'fastify'

const app = fastify()
app.get('/test', getOperationalSummary)

app.inject({ method: 'GET', url: '/test' }).then(response => {
    console.log("Status:", response.statusCode)
    console.log("Body:", response.json())
}).catch(console.error)
