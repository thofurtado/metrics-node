import { describe, it, expect } from 'vitest'
import { calculateCreditCardDueDate } from './credit-card-due-date'

describe('Credit Card Due Date Service', () => {
    it('should calculate due date in the current cycle when purchase is before closing day', () => {
        // Fechamento dia 10, Vencimento dia 18 (18/09/2026 é sexta-feira)
        const card = { closing_day: 10, due_day: 18 }
        const purchaseDate = new Date(2026, 8, 5) // 05/09/2026

        const result = calculateCreditCardDueDate(purchaseDate, card)

        expect(result.due_date.getDate()).toBe(18)
        expect(result.due_date.getMonth()).toBe(8) // Setembro (0-indexed)
        expect(result.due_date.getFullYear()).toBe(2026)
        expect(result.billing_month).toBe('2026-09')
    })

    it('should advance to next month invoice when purchase is on or after closing day (best day)', () => {
        // Fechamento dia 10, Vencimento dia 18 (18/10/2026 é domingo -> avança p/ 19/10 segunda)
        const card = { closing_day: 10, due_day: 20 }
        const purchaseDate = new Date(2026, 8, 12) // 12/09/2026 (após dia 10)

        // 20/10/2026 é terça-feira
        const result = calculateCreditCardDueDate(purchaseDate, card)

        expect(result.due_date.getDate()).toBe(20)
        expect(result.due_date.getMonth()).toBe(9) // Outubro
        expect(result.due_date.getFullYear()).toBe(2026)
        expect(result.billing_month).toBe('2026-10')
    })

    it('should correctly handle cards where due_day is smaller than closing_day (due in next month)', () => {
        // Fechamento dia 25, Vencimento dia 05 (05/10/2026 é segunda-feira)
        const card = { closing_day: 25, due_day: 5 }
        const purchaseDate = new Date(2026, 8, 10) // 10/09/2026 (antes do dia 25)

        // Fecha em 25/09, vence em 05/10
        const result = calculateCreditCardDueDate(purchaseDate, card)

        expect(result.due_date.getDate()).toBe(5)
        expect(result.due_date.getMonth()).toBe(9) // Outubro
        expect(result.due_date.getFullYear()).toBe(2026)
        expect(result.billing_month).toBe('2026-10')
    })

    it('should advance to Monday if due date falls on Saturday or Sunday', () => {
        // 20/09/2026 é Domingo
        const card = { closing_day: 10, due_day: 20 }
        const purchaseDate = new Date(2026, 8, 2) // 02/09/2026

        const result = calculateCreditCardDueDate(purchaseDate, card)

        // Domingo dia 20 deve avançar para Segunda dia 21
        expect(result.due_date.getDay()).toBe(1) // Segunda-feira
        expect(result.due_date.getDate()).toBe(21)
    })

    it('should advance to next business day if due date falls on a holiday', () => {
        // Fechamento dia 10, Vencimento dia 21 (segunda). Mas se dia 21 for feriado -> dia 22
        const card = { closing_day: 10, due_day: 21 }
        const purchaseDate = new Date(2026, 8, 2)
        const holidays = ['2026-09-21']

        const result = calculateCreditCardDueDate(purchaseDate, card, holidays)

        expect(result.due_date.getDate()).toBe(22)
    })
})
