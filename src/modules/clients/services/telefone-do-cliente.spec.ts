import { describe, it, expect } from 'vitest'
import { acharClienteComTelefone, digitosDoTelefone, mesmoTelefone, telefoneDeVerdade } from './telefone-do-cliente'

describe('telefone do cliente (16:A8)', () => {
    it('compara pelos dígitos, com ou sem máscara e com ou sem o 55', () => {
        expect(mesmoTelefone('(11) 98765-4321', '11987654321')).toBe(true)
        expect(mesmoTelefone('+55 11 98765-4321', '11987654321')).toBe(true)
        expect(mesmoTelefone('11987654321', '11987654322')).toBe(false)
        expect(digitosDoTelefone('011 98765-4321')).toBe('1198765' + '4321')
    })

    it('"00000000000" e telefone curto não contam como telefone', () => {
        expect(telefoneDeVerdade('00000000000')).toBe(false)
        expect(telefoneDeVerdade('1234')).toBe(false)
        expect(mesmoTelefone('00000000000', '00000000000')).toBe(false)
    })

    it('acha o outro cadastro com o mesmo telefone e ignora o próprio', async () => {
        const db = {
            client: {
                findMany: async ({ where }: any) => [
                    { id: 'c1', name: 'Maria', phone: '(11) 98765-4321' },
                    { id: 'c2', name: 'João', phone: '11 3333-4321' },
                ].filter(c => c.phone.includes(where.phone.contains) && c.id !== where.id?.not),
            },
        }
        expect(await acharClienteComTelefone(db as any, '11987654321')).toEqual({ id: 'c1', name: 'Maria' })
        expect(await acharClienteComTelefone(db as any, '11987654321', 'c1')).toBeNull()
        expect(await acharClienteComTelefone(db as any, '')).toBeNull()
    })
})
