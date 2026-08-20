import { describe, it, expect, beforeEach } from 'vitest'

interface CashierSession {
    id: string
    user_id: string
    initial_balance: number
    period: string
    status: 'OPEN' | 'PENDING' | 'CLOSED'
    opened_at: Date
    closed_at?: Date
}

interface CashierEntry {
    id: string
    cashier_session_id: string
    payment_method: string
    origin: string
    amount: number
    type: 'SALE' | 'WITHDRAWAL' | 'ADDITION' | 'VALE' | 'TIP'
    is_withdrawal: boolean
    is_addition: boolean
    employee_id?: string
    identification?: string
}

interface Transaction {
    id: string
    operation: 'in' | 'out'
    amount: number
    account_id: string
    description: string
    payment_method: string
    cashier_session_id?: string
}

interface PayrollEntry {
    id: string
    employee_id: string
    description: string
    amount: number
    type: 'VALE' | 'SALARIO'
    status: 'PENDING' | 'PAID'
}

class InMemoryCashierService {
    public sessions: CashierSession[] = []
    public entries: CashierEntry[] = []
    public transactions: Transaction[] = []
    public payrollEntries: PayrollEntry[] = []

    openSession(userId: string, initialBalance: number, period: string = 'Almoço'): CashierSession {
        const existingOpen = this.sessions.find(s => s.user_id === userId && s.status === 'OPEN')
        if (existingOpen) {
            throw new Error('Já existe uma sessão de caixa aberta para este usuário.')
        }

        const session: CashierSession = {
            id: `session-${Date.now()}-${Math.random()}`,
            user_id: userId,
            initial_balance: initialBalance,
            period,
            status: 'OPEN',
            opened_at: new Date()
        }
        this.sessions.push(session)
        return session
    }

    addEntry(data: Omit<CashierEntry, 'id'>): CashierEntry {
        const session = this.sessions.find(s => s.id === data.cashier_session_id)
        if (!session || session.status !== 'OPEN') {
            throw new Error('Caixa fechado ou não encontrado.')
        }

        const entry: CashierEntry = {
            id: `entry-${Date.now()}-${Math.random()}`,
            ...data
        }
        this.entries.push(entry)
        return entry
    }

    registerWithdrawal(sessionId: string, amount: number, reason: string): CashierEntry {
        return this.addEntry({
            cashier_session_id: sessionId,
            payment_method: 'Dinheiro',
            origin: 'Gaveta',
            amount,
            type: 'WITHDRAWAL',
            is_withdrawal: true,
            is_addition: false,
            identification: `Sangria: ${reason}`
        })
    }

    registerAddition(sessionId: string, amount: number, reason: string): CashierEntry {
        return this.addEntry({
            cashier_session_id: sessionId,
            payment_method: 'Dinheiro',
            origin: 'Cofre',
            amount,
            type: 'ADDITION',
            is_withdrawal: false,
            is_addition: true,
            identification: `Suprimento: ${reason}`
        })
    }

    registerEmployeeVale(sessionId: string, employeeId: string, amount: number, description: string): CashierEntry {
        const entry = this.addEntry({
            cashier_session_id: sessionId,
            payment_method: 'Dinheiro',
            origin: 'Gaveta',
            amount,
            type: 'VALE',
            is_withdrawal: true,
            is_addition: false,
            employee_id: employeeId,
            identification: `Vale Funcionário: ${description}`
        })

        this.payrollEntries.push({
            id: `payroll-${Date.now()}`,
            employee_id: employeeId,
            description: `Vale Caixa: ${description}`,
            amount,
            type: 'VALE',
            status: 'PAID'
        })

        return entry
    }

    closeAndAuditSession(sessionId: string, physicalCountDinheiro: number, accountBbId: string, accountCofreId: string) {
        const session = this.sessions.find(s => s.id === sessionId)
        if (!session) throw new Error('Sessão não encontrada')

        const entries = this.entries.filter(e => e.cashier_session_id === sessionId)

        let totalDinheiroEntradas = session.initial_balance
        let totalDinheiroSaidas = 0
        let totalCartoesPix = 0

        for (const entry of entries) {
            if (entry.payment_method === 'Dinheiro') {
                if (entry.is_withdrawal) {
                    totalDinheiroSaidas += entry.amount
                } else {
                    totalDinheiroEntradas += entry.amount
                }
            } else {
                totalCartoesPix += entry.amount
                this.transactions.push({
                    id: `tx-${Date.now()}-${Math.random()}`,
                    operation: 'in',
                    amount: entry.amount,
                    account_id: accountBbId,
                    description: `Recebimento ${entry.payment_method} - ${entry.identification || 'Venda'}`,
                    payment_method: entry.payment_method,
                    cashier_session_id: sessionId
                })
            }
        }

        const saldoDinheiroEsperado = totalDinheiroEntradas - totalDinheiroSaidas
        const divergencia = physicalCountDinheiro - saldoDinheiroEsperado

        this.transactions.push({
            id: `tx-dinheiro-${Date.now()}`,
            operation: 'in',
            amount: physicalCountDinheiro,
            account_id: accountCofreId,
            description: `Fechamento Caixa ${session.period} - Saldo em Espécie Depositado`,
            payment_method: 'DINHEIRO',
            cashier_session_id: sessionId
        })

        session.status = 'CLOSED'
        session.closed_at = new Date()

        return {
            saldoDinheiroEsperado,
            saldoDinheiroInformado: physicalCountDinheiro,
            divergencia,
            totalCartoesPix,
            totalGeralVendas: entries.filter(e => e.type === 'SALE').reduce((acc, e) => acc + e.amount, 0)
        }
    }
}

describe('Cashier Session & Financial Reconciliation Use Cases', () => {
    let service: InMemoryCashierService

    beforeEach(() => {
        service = new InMemoryCashierService()
    })

    it('deve abrir sessão de caixa com fundo de troco inicial e impedir sessões duplicadas', () => {
        const session = service.openSession('user-1', 200.00, 'Almoço')

        expect(session.id).toBeDefined()
        expect(session.initial_balance).toBe(200.00)
        expect(session.status).toBe('OPEN')
        expect(session.period).toBe('Almoço')

        expect(() => {
            service.openSession('user-1', 100.00, 'Almoço')
        }).toThrow('Já existe uma sessão de caixa aberta para este usuário.')
    })

    it('deve registrar vendas em dinheiro, pix e cartões corretamente', () => {
        const session = service.openSession('user-1', 200.00, 'Jantar')

        const v1 = service.addEntry({
            cashier_session_id: session.id,
            payment_method: 'Dinheiro',
            origin: 'Mesa 1',
            amount: 85.00,
            type: 'SALE',
            is_withdrawal: false,
            is_addition: false,
            identification: 'Mesa 1'
        })

        const v2 = service.addEntry({
            cashier_session_id: session.id,
            payment_method: 'Pix',
            origin: 'Delivery',
            amount: 120.00,
            type: 'SALE',
            is_withdrawal: false,
            is_addition: false,
            identification: 'Delivery #101'
        })

        const v3 = service.addEntry({
            cashier_session_id: session.id,
            payment_method: 'Cartão de Crédito',
            origin: 'Balcão',
            amount: 65.00,
            type: 'SALE',
            is_withdrawal: false,
            is_addition: false,
            identification: 'Balcão #12'
        })

        expect(service.entries).toHaveLength(3)
        expect(v1.amount).toBe(85.00)
        expect(v2.amount).toBe(120.00)
        expect(v3.amount).toBe(65.00)
    })

    it('deve processar sangrias, suprimentos e vales de funcionários gerando lançamentos de folha', () => {
        const session = service.openSession('user-1', 200.00, 'Jantar')

        const sangria = service.registerWithdrawal(session.id, 100.00, 'Sangria para o cofre')
        expect(sangria.is_withdrawal).toBe(true)
        expect(sangria.amount).toBe(100.00)

        const suprimento = service.registerAddition(session.id, 50.00, 'Troco em moedas')
        expect(suprimento.is_addition).toBe(true)
        expect(suprimento.amount).toBe(50.00)

        const vale = service.registerEmployeeVale(session.id, 'emp-carlos', 70.00, 'Adiantamento transporte')
        expect(vale.type).toBe('VALE')
        expect(vale.employee_id).toBe('emp-carlos')

        expect(service.payrollEntries).toHaveLength(1)
        expect(service.payrollEntries[0].employee_id).toBe('emp-carlos')
        expect(service.payrollEntries[0].amount).toBe(70.00)
        expect(service.payrollEntries[0].status).toBe('PAID')
    })

    it('deve fechar o caixa e realizar conciliação perfeita apurando sobras ou faltas', () => {
        const session = service.openSession('user-1', 200.00, 'Almoço')

        service.addEntry({ cashier_session_id: session.id, payment_method: 'Dinheiro', origin: 'Mesa', amount: 150.00, type: 'SALE', is_withdrawal: false, is_addition: false })
        service.addEntry({ cashier_session_id: session.id, payment_method: 'Pix', origin: 'Mesa', amount: 200.00, type: 'SALE', is_withdrawal: false, is_addition: false })
        service.addEntry({ cashier_session_id: session.id, payment_method: 'Cartão de Crédito', origin: 'Mesa', amount: 300.00, type: 'SALE', is_withdrawal: false, is_addition: false })

        service.registerWithdrawal(session.id, 50.00, 'Sangria almoço')

        const auditExato = service.closeAndAuditSession(session.id, 300.00, 'acc-bb', 'acc-cofre')

        expect(auditExato.saldoDinheiroEsperado).toBe(300.00)
        expect(auditExato.saldoDinheiroInformado).toBe(300.00)
        expect(auditExato.divergencia).toBe(0.00)
        expect(auditExato.totalCartoesPix).toBe(500.00)
        expect(auditExato.totalGeralVendas).toBe(650.00)

        expect(service.transactions.length).toBeGreaterThanOrEqual(3)
    })

    it('deve identificar falta de caixa quando o valor contado for menor que o esperado', () => {
        const session = service.openSession('user-2', 200.00, 'Jantar')
        service.addEntry({ cashier_session_id: session.id, payment_method: 'Dinheiro', origin: 'Mesa', amount: 100.00, type: 'SALE', is_withdrawal: false, is_addition: false })

        const audit = service.closeAndAuditSession(session.id, 280.00, 'acc-bb', 'acc-cofre')
        expect(audit.saldoDinheiroEsperado).toBe(300.00)
        expect(audit.saldoDinheiroInformado).toBe(280.00)
        expect(audit.divergencia).toBe(-20.00)
    })
})
