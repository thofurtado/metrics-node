import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createSector } from '@/modules/financial/http/controllers/sector'
import { getSector } from '@/modules/financial/http/controllers/getSector'
import { createAccount } from '@/modules/financial/http/controllers/account'
import { getAccount } from '@/modules/financial/http/controllers/getAccount'
import { createTransaction } from '@/modules/financial/http/controllers/transaction'
import { getTransactions } from '@/modules/financial/http/controllers/getTransactions'
import { getTransferTransaction } from '@/modules/financial/http/controllers/getTransferTransaction'
import { createPayment } from '@/modules/financial/http/controllers/payment'
import { createPaymentEntry } from '@/modules/financial/http/controllers/paymentEntry'
import { verifyUserRole } from '@/http/middlewares/verify-user-role'
import { changeTransactionStatus } from '@/modules/financial/http/controllers/changeTransactionPayment'
import { deleteTransaction } from '@/modules/financial/http/controllers/deleteTransaction'
import { getPayments } from '@/modules/financial/http/controllers/getPayments'
import { getFinancialSummary } from '@/modules/financial/http/controllers/get-financial-summary'
import { bulkPayTransactions } from '@/modules/financial/http/controllers/bulk-pay-transactions'

import { updateAccount } from '@/modules/financial/http/controllers/updateAccount'
import { deleteAccount } from '@/modules/financial/http/controllers/deleteAccount'
import { updatePayment } from '@/modules/financial/http/controllers/updatePayment'
import { deletePayment } from '@/modules/financial/http/controllers/deletePayment'
import { adjustAccountBalance } from '@/modules/financial/http/controllers/adjustAccountBalance'
import { revertTransactionStatus } from '@/modules/financial/http/controllers/revertTransactionStatus'
import { createRecurring } from './create-recurring'
import { terminateTransactionGroup } from '@/modules/financial/http/controllers/terminate-transaction-group'
import { getTransactionGroup } from '@/modules/financial/http/controllers/get-transaction-group'

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
    app.patch('/transactions/bulk-pay', bulkPayTransactions)
    app.patch('/revert-transaction/:id', revertTransactionStatus)
    app.get('/payments', getPayments)
    app.put('/payment/:id', updatePayment)
    app.delete('/payment/:id', deletePayment)
    app.get('/summary', getFinancialSummary)
}
