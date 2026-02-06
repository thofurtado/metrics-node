import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
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
import { getPayments } from './getPayments'
import { getFinancialSummary } from './get-financial-summary'

import { updateAccount } from './updateAccount'
import { deleteAccount } from './deleteAccount'
import { updatePayment } from './updatePayment'
import { deletePayment } from './deletePayment'
import { adjustAccountBalance } from './adjustAccountBalance'
import { revertTransactionStatus } from './revertTransactionStatus'
import { createRecurring } from './create-recurring'
import { terminateTransactionGroup } from './terminate-transaction-group'
import { getTransactionGroup } from './get-transaction-group'

export async function financialRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)
    app.post('/sector', { onRequest: [verifyUserRole('ADMIN')] }, createSector)
    app.get('/sectors', getSector)

    app.post('/account', createAccount)
    app.get('/accounts', getAccount)
    app.patch('/account/:id/adjust-balance', adjustAccountBalance)
    app.put('/account/:id', updateAccount)
    app.delete('/account/:id', deleteAccount)

    app.post('/transaction', createTransaction)
    app.get('/transactions', getTransactions)
    app.delete('/transaction/:id', deleteTransaction)
    app.get('/transfer-transactions', getTransferTransaction)

    app.patch('/transaction-groups/:groupId/terminate', terminateTransactionGroup)
    app.get('/transaction-groups/:groupId', getTransactionGroup)

    app.post('/payment', createPayment)
    app.post('/payment-entry', createPaymentEntry)
    app.patch('/switch-transaction/:id', changeTransactionStatus)
    app.patch('/revert-transaction/:id', revertTransactionStatus)
    app.get('/payments', getPayments)
    app.put('/payment/:id', updatePayment)
    app.delete('/payment/:id', deletePayment)
    app.get('/summary', getFinancialSummary)
}
