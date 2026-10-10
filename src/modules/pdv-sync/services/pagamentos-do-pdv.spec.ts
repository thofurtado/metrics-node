import { describe, expect, it } from 'vitest'
import { categoriaDeCartao, categoriasDaMaquininha, metodoNaConferencia, tipoDoIdentificador } from './pagamentos-do-pdv'

describe('categoriaDeCartao (10/10/2026)', () => {
    it.each([
        ['Cartão de Crédito', 'CREDITO'], ['CRÉDITO', 'CREDITO'], ['CREDIT', 'CREDITO'], ['crédito', 'CREDITO'],
        ['Cartão de Débito', 'DEBITO'], ['DÉBITO', 'DEBITO'], ['DEBIT', 'DEBITO'],
        ['Pix', 'PIX'], ['PIX', 'PIX'],
        ['Vale Refeição (VR/Sodexo/Alelo)', 'VOUCHER'], ['VOUCHER', 'VOUCHER'], ['Voucher', 'VOUCHER'], ['VR', 'VOUCHER'],
    ])('%s é %s', (texto, categoria) => expect(categoriaDeCartao(texto)).toBe(categoria))

    it.each(['Dinheiro', 'A Prazo (Correntista)', '', null])('%s não é cartão', (texto) => expect(categoriaDeCartao(texto)).toBeNull())
})

describe('categoriasDaMaquininha', () => {
    it('pelas taxas da web, sem repetir e em ordem (dados reais da Katatau e da loja de teste)', () => {
        expect(categoriasDaMaquininha([
            { payment_category: 'VOUCHER' }, { payment_category: 'CRÉDITO' }, { payment_category: 'PIX' }, { payment_category: 'DÉBITO' },
        ])).toEqual(['CREDITO', 'DEBITO', 'PIX', 'VOUCHER'])
        expect(categoriasDaMaquininha([{ payment_category: 'CREDIT' }, { payment_category: 'DEBIT' }, { payment_category: 'PIX' }]))
            .toEqual(['CREDITO', 'DEBITO', 'PIX'])
        expect(categoriasDaMaquininha([])).toEqual([])
    })
})

describe('tipoDoIdentificador', () => {
    it('a prazo, evasão ou nada', () => {
        expect(tipoDoIdentificador({ is_correntista_debt: true, is_stock_evasion: false })).toBe('CreditoLoja')
        expect(tipoDoIdentificador({ is_correntista_debt: false, is_stock_evasion: true })).toBe('Evasao')
        expect(tipoDoIdentificador({ is_correntista_debt: false, is_stock_evasion: false })).toBe('')
    })
})

describe('metodoNaConferencia', () => {
    it('o identificador manda (Correntista, Funcionário, Permuta), sem o espaço que sobra no cadastro', () => {
        expect(metodoNaConferencia({ Method: 'A Prazo (Correntista)', Categoria: 'CreditoLoja' }, 'Correntista ')).toBe('Correntista')
        expect(metodoNaConferencia({ Method: 'A Prazo (Correntista)', Categoria: 'CreditoLoja' }, 'Funcionário')).toBe('Funcionário')
    })

    it('pela categoria do PDV, com os nomes do caixa da web', () => {
        expect(metodoNaConferencia({ Method: 'Cartão de Crédito', Categoria: 'Credito' })).toBe('Crédito')
        expect(metodoNaConferencia({ Method: 'Cartão de Débito', Categoria: 'Debito' })).toBe('Débito')
        expect(metodoNaConferencia({ Method: 'Pix', Categoria: 'Pix' })).toBe('PIX')
        expect(metodoNaConferencia({ Method: 'Vale Refeição (VR/Sodexo/Alelo)', Categoria: 'Voucher' })).toBe('Voucher')
        expect(metodoNaConferencia({ Method: 'Dinheiro', Categoria: 'Dinheiro' })).toBe('Dinheiro')
    })

    it('PDV antigo (sem categoria) e a prazo sem identificador ficam com o nome do PDV', () => {
        expect(metodoNaConferencia({ Method: 'Cartão de Crédito' })).toBe('Cartão de Crédito')
        expect(metodoNaConferencia({ Method: 'A Prazo', Categoria: 'CreditoLoja' })).toBe('A Prazo')
    })
})
