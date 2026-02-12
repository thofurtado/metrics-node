import request from 'supertest'
import { app } from '@/app'
import { prisma } from '@/lib/prisma'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hash } from 'bcryptjs'

// IMPORTANT: Environment Setup
// Ensure 'supertest' is installed: npm i -D supertest @types/supertest

describe('System Modularization & Logic (Integration Suite)', () => {
    let token: string

    beforeAll(async () => {
        await app.ready()
    })

    afterAll(async () => {
        await app.close()
    })

    beforeEach(async () => {
        // [TEARDOWN] Clean up database to ensure isolation
        // Deletion order is critical to respect Foreign Key constraints
        await prisma.transferTransaction.deleteMany() // Depends on Transaction
        await prisma.installmentPayment.deleteMany() // Depends on Transaction/Payment
        await prisma.transaction.deleteMany()   // Depends on Account
        await prisma.paymentEntry.deleteMany()  // Depends on Payment/Treatment
        await prisma.payment.deleteMany()       // Depends on Account
        await prisma.account.deleteMany()

        await prisma.interaction.deleteMany()   // Depends on Treatment/User
        await prisma.treatmentItem.deleteMany() // Depends on Treatment/Product
        await prisma.treatment.deleteMany()     // Depends on Client/User

        await prisma.stock.deleteMany()
        await prisma.product.deleteMany()

        await prisma.client.deleteMany()
        await prisma.user.deleteMany()          // Independent (mostly)

        await prisma.systemConfig.deleteMany()  // Independent

        // [SETUP] Create Admin User for Auth
        const password_hash = await hash('123456', 6)
        await prisma.user.create({
            data: {
                name: 'Admin User',
                email: 'admin@metrics.com',
                password_hash,
                role: 'ADMIN' // Required for some routes
            }
        })

        // [SETUP] Authenticate and get Token
        const authResponse = await request(app.server)
            .post('/sessions')
            .send({
                email: 'admin@metrics.com',
                password: '123456'
            })

        token = authResponse.body.token
    })

    // =========================================================================
    // SCENARIO 1: MODULE SECURITY (Financial Disabled)
    // =========================================================================
    describe('Cenário 1: Segurança de Módulo (Financeiro Desativado)', () => {
        it('should BLOCK creating a Transaction when Financial Module is DISABLED (Edge Case)', async () => {
            // 1. Disable Financial Module in SystemConfig
            await prisma.systemConfig.create({
                data: {
                    financial_module: false, // DISABLED
                    treatments_module: true,
                    merchandise_module: true
                }
            })

            // 2. Setup: Create an account (manually, bypassing checks for setup sake)
            const account = await prisma.account.create({
                data: { name: 'Legacy Account', balance: 0 }
            })

            // 3. Action: Try to create a transaction via API
            const response = await request(app.server)
                .post('/transaction')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    operation: 'expense',
                    amount: 100,
                    account_id: account.id,
                    description: 'Should be Blocked',
                    confirmed: true
                })

            // 4. Assertion: Expect 403 Forbidden
            expect(response.statusCode).toEqual(403)

            // Validate Body Structure for Error Message
            expect(response.body).toEqual(expect.objectContaining({
                message: expect.stringMatching(/desativado|disabled|forbidden/i)
            }))
        })
    })

    // =========================================================================
    // SCENARIO 2: SIMPLIFIED MODE (Treatments Only)
    // =========================================================================
    describe('Cenário 2: Modo Simplificado (Apenas Atendimentos)', () => {
        it('should ALLOW creating a Treatment with basic data when other modules are DISABLED (Happy Path)', async () => {
            // 1. Setup Simplified Mode: Treatments ON, Others OFF
            await prisma.systemConfig.create({
                data: {
                    treatments_module: true,
                    financial_module: false,
                    merchandise_module: false
                }
            })

            const client = await prisma.client.create({
                data: { name: 'Simple Client', identification: '12345678900' }
            })

            // 2. Action: Create Treatment without items or financial data
            const response = await request(app.server)
                .post('/treatment')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    client_id: client.id,
                    request: 'Simple Service Request',
                    status: 'pending',
                })

            // 3. Assertion: Expect 201 Created and Valid Body
            expect(response.statusCode).toEqual(201)

            expect(response.body).toEqual(expect.objectContaining({
                treatment: expect.objectContaining({
                    id: expect.any(String),
                    request: 'Simple Service Request',
                    status: 'pending'
                })
            }))
        })
    })

    // =========================================================================
    // SCENARIO 3: DATA VALIDATION (Duplication)
    // =========================================================================
    describe('Cenário 3: Validação de Duplicidade (Clientes)', () => {
        it('should BLOCK creating a Client with duplicate identification (CPF/CNPJ) (Edge Case)', async () => {
            // 1. Setup: Ensure module is active
            await prisma.systemConfig.create({
                data: { treatments_module: true }
            })

            // 2. Create first client
            await prisma.client.create({
                data: {
                    name: 'Client A',
                    identification: '11122233344',
                    email: 'a@test.com'
                }
            })

            // 3. Action: Try create second client with SAME identification via API
            // Using API to test Controller/UseCase validation layer
            const response = await request(app.server)
                .post('/clients') // Verify your route path is correct in your app (sometimes /client or /clients)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Client B',
                    identification: '11122233344', // DUPLICATE ID
                    email: 'b@test.com'
                })

            // 4. Assertion: Expect 409 Conflict
            expect(response.statusCode).toBeGreaterThanOrEqual(400) // Could be 400 or 409 depending on implementation

            // Check for specific error message regarding duplication
            expect(response.body).toEqual(expect.objectContaining({
                message: expect.stringMatching(/exist|duplic|already/i)
            }))
        })
    })

    // =========================================================================
    // SCENARIO 4: CASCADING INTEGRITY (Merchandise Disabled)
    // =========================================================================
    describe('Cenário 4: Integridade de Cascata (Mercadorias Desativado)', () => {
        it('should BLOCK adding Treatment Items when Merchandise Module is DISABLED (Edge Case)', async () => {
            // 1. Setup: Treatments ON, Merchandise OFF
            await prisma.systemConfig.create({
                data: {
                    treatments_module: true,
                    merchandise_module: false
                }
            })

            const client = await prisma.client.create({ data: { name: 'Client Test' } })
            const treatment = await prisma.treatment.create({
                data: {
                    client_id: client.id,
                    request: 'Test Items',
                    status: 'pending'
                }
            })

            // 2. Action: Try to add an item via API
            const response = await request(app.server)
                .post('/treatment-item')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    treatment_id: treatment.id,
                    quantity: 1,
                    product_id: 'some-fake-id', // Logic should fail before checking ID validity if module check is first
                })

            // 3. Assertion: Expect 403 Forbidden because Merchandise is OFF
            expect(response.statusCode).toEqual(403)
            expect(response.body).toEqual(expect.objectContaining({
                message: expect.stringMatching(/módulo.*desativado|disabled/i)
            }))
        })
    })

    // =========================================================================
    // SCENARIO 5: FULL FLOW INTEGRATION (All Modules Active)
    // =========================================================================
    describe('Cenário 5: Integração de Fluxo (Todos Módulos Ativos)', () => {
        it('should AUTOMATICALLY create a Financial Transaction when finishing a treatment (Happy Path)', async () => {
            // 1. Setup: ALL Modules ON
            await prisma.systemConfig.create({
                data: {
                    treatments_module: true,
                    financial_module: true,
                    merchandise_module: true
                }
            })

            // 2. Setup Data: Client, Account, Treatment, Payment Method, Payment Entry
            const account = await prisma.account.create({
                data: { name: 'Main Bank', balance: 1000 }
            })

            const client = await prisma.client.create({ data: { name: 'Full Service Client' } })

            const treatment = await prisma.treatment.create({
                data: {
                    client_id: client.id,
                    request: 'Full Service with Payment',
                    status: 'pending',
                    amount: 200 // Total Cost
                }
            })

            // Pre-register the payment method (e.g. Cash)
            const paymentMethod = await prisma.payment.create({
                data: {
                    name: 'Cash',
                    installment_limit: 1,
                    in_sight: true,
                    account_id: account.id
                }
            })

            // Link the payment to the treatment (User would do this in UI before finishing)
            await prisma.paymentEntry.create({
                data: {
                    amount: 200,
                    treatment_id: treatment.id,
                    occurrences: 1,
                    payment_id: paymentMethod.id
                }
            })

            // 3. Action: Finish Treatment
            const response = await request(app.server)
                .patch(`/treatment/${treatment.id}/finish`)
                .set('Authorization', `Bearer ${token}`)
                .send()

            // 4. Assertion: Expect Success
            expect(response.statusCode).toEqual(200)

            // 5. Verify Side Effect: Transaction was created in the Database
            const transaction = await prisma.transaction.findFirst({
                where: {
                    account_id: account.id,
                    amount: 200,
                    operation: 'income'
                }
            })

            // Validating the Transaction record
            expect(transaction).toBeTruthy()
            expect(transaction?.description).toContain('Full Service with Payment')
            expect(transaction?.confirmed).toBe(true) // Confirmed because payment was 'in_sight'

            // Verify Account Balance Update (1000 + 200 = 1200)
            const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } })
            expect(updatedAccount?.balance).toBe(1200)
        })
    })

})
