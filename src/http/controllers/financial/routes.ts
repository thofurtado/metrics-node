import { FastifyInstance } from 'fastify'
import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createSector } from './sector'
import { getSector } from './getSector'
import { createAccount } from './account'
import { getAccount } from './getAccount'
import { createTransaction } from './transaction'
import { getTransactions } from './getTransactions'
import { getTransferTransaction } from './getTransferTransaction'
import { createPayment } from './payment'
import { createPaymentEntry } from './paymentEntry'
import { verifyUserRole } from '@/http/middlewares/verify-user-role'
import { changeTransactionStatus } from './changeTransactionPayment'
import { deleteTransaction } from './deleteTransaction'


export async function financialRoutes(app: FastifyInstance) {
    app.addHook('onRequest',verifyJWT)
    app.post('/sector', {onRequest: [verifyUserRole('ADMIN')]} ,createSector)
    app.get('/sectors', getSector)

    app.post('/account', createAccount)
    app.get('/accounts', getAccount)

    app.post('/transaction', createTransaction)
    app.get('/transactions', getTransactions)
    app.delete('/transaction/:id', deleteTransaction)
    app.get('/transfer-transactions',getTransferTransaction)

    app.post('/payment', createPayment)
    app.post('/payment-entry', createPaymentEntry)
    app.patch('/switch-transaction/:id', changeTransactionStatus)




}
