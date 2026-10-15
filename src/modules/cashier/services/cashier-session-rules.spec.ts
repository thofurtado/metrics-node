import { describe, expect, it } from 'vitest'
import { manterMarcaDoCaixa, motivoParaNaoAlterarSaldoInicial } from './cashier-session-rules'

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

describe('marca do caixa no vale do RH (Mergulho 14:X4)', () => {
    const id = '3f2a9c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6'
    const atual = `Vale Sangria Caixa Turno 01 - Ana (Caixa ${id})`

    it('editar o texto mantém a marca no fim', () => {
        expect(manterMarcaDoCaixa(atual, 'Vale da Ana')).toBe(`Vale da Ana (Caixa ${id})`)
    })

    it('texto novo que já traz a marca fica igual', () => {
        expect(manterMarcaDoCaixa(atual, `Vale corrigido (Caixa ${id})`)).toBe(`Vale corrigido (Caixa ${id})`)
    })

    it('vale lançado à mão (sem marca) não ganha marca', () => {
        expect(manterMarcaDoCaixa('Vale avulso', 'Vale avulso da Ana')).toBe('Vale avulso da Ana')
    })

    it('sem descrição nova não muda nada', () => {
        expect(manterMarcaDoCaixa(atual, undefined)).toBeUndefined()
    })
})
