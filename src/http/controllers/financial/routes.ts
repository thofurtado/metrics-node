import { FastifyInstance } from 'fastify'
import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createSector } from './sector'
import { getSector } from './getSector'
import { createAccount } from './account'
import { getAccount } from './getAccount'
import { createTransaction } from './transaction'
import { getTransaction } from './getTransaction'
import { getTransferTransaction } from './getTransferTransaction'
import { createPayment } from './payment'
import { createPaymentEntry } from './paymentEntry'

export async function financialRoutes(app: FastifyInstance) {
    app.addHook('onRequest',verifyJWT)
    app.post('/sector', createSector)
    app.get('/sectors', getSector)

    app.post('/account', createAccount)
    app.get('/accounts', getAccount)

    app.post('/transaction', createTransaction)
    app.get('/transactions', getTransaction)

    app.get('/transfer-transactions',getTransferTransaction)

    app.post('/payment', createPayment)
    app.post('/payment-entry', createPaymentEntry)

}
