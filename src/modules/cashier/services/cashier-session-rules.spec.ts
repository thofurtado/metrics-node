import { describe, expect, it } from 'vitest'
import { motivoParaNaoAlterarSaldoInicial } from './cashier-session-rules'

describe('saldo inicial do caixa (Mergulho 14:X1)', () => {
    it('caixa aberto: qualquer usuário altera', () => {
        expect(motivoParaNaoAlterarSaldoInicial('OPEN', false)).toBeNull()
        expect(motivoParaNaoAlterarSaldoInicial('OPEN', true)).toBeNull()
    })

    it('caixa em conferência (PENDING): só o ADMIN altera', () => {
        expect(motivoParaNaoAlterarSaldoInicial('PENDING', true)).toBeNull()
        expect(motivoParaNaoAlterarSaldoInicial('PENDING', false)).toMatch(/administrador/)
    })

    it('caixa conferido (CHECKED): ninguém altera, nem o ADMIN', () => {
        expect(motivoParaNaoAlterarSaldoInicial('CHECKED', true)).toMatch(/conferido/)
        expect(motivoParaNaoAlterarSaldoInicial('CHECKED', false)).toMatch(/conferido/)
    })

    it('nomes antigos CLOSED e AUDITED continuam travados', () => {
        expect(motivoParaNaoAlterarSaldoInicial('AUDITED', true)).toMatch(/conferido/)
        expect(motivoParaNaoAlterarSaldoInicial('CLOSED', false)).toMatch(/administrador/)
        expect(motivoParaNaoAlterarSaldoInicial('closed', true)).toBeNull()
    })
})
