import { describe, it, expect } from 'vitest'
import { cstIcmsValido, csosnValido, cfopValido, ncmValido, cestValido, cstPisCofinsValido, codigoBarrasValido, origemValida, fiscaisLimpos } from './codigos-fiscais'

// Caso da Katatau (09/10/2026): FRUIT-TELLA chegou com cst_icms "18,0" (a alíquota) e travou a sincronização do PDV inteiro.
describe('Códigos fiscais do produto', () => {
  it('alíquota no lugar do CST do ICMS vira vazio', () => {
    expect(cstIcmsValido('18,0')).toBeNull()
    expect(cstIcmsValido('0,00')).toBeNull()
    expect(cstIcmsValido('18')).toBeNull() // alíquota com 2 dígitos não é CST
    expect(cstIcmsValido('II')).toBeNull() // "Isento" da impressora fiscal antiga do Athos
    expect(cstIcmsValido('00')).toBe('00')
    expect(cstIcmsValido('060')).toBe('060')
    expect(cstIcmsValido('960')).toBeNull() // origem 9 não existe
    expect(cstIcmsValido(null)).toBeNull()
  })

  it('NCM, CEST e CFOP aceitam pontos e ficam só com os dígitos', () => {
    expect(ncmValido('2106.90.90')).toBe('21069090')
    expect(ncmValido('0403')).toBe('0403')
    expect(ncmValido('210690901')).toBeNull()
    expect(cestValido('17.049.00')).toBe('1704900')
    expect(cestValido('170490')).toBeNull()
    expect(cfopValido('5.102')).toBe('5102')
    expect(cfopValido('51020')).toBeNull()
  })

  it('CSOSN, CST de PIS/COFINS, código de barras e origem', () => {
    expect(csosnValido('102')).toBe('102')
    expect(csosnValido('1020')).toBeNull()
    expect(csosnValido('104')).toBeNull()
    expect(csosnValido('500')).toBe('500')
    expect(cstPisCofinsValido('49')).toBe('49')
    expect(cstPisCofinsValido('4,9')).toBeNull()
    expect(codigoBarrasValido(' 7895144028019 ')).toBe('7895144028019')
    expect(codigoBarrasValido('x'.repeat(51))).toBeNull()
    expect(origemValida('0')).toBe(0)
    expect(origemValida('9')).toBe(0)
    expect(origemValida(2)).toBe(2)
  })

  it('o produto da Katatau sai limpo para o PDV', () => {
    const p = fiscaisLimpos({ barcode: '7895144028019', ncm: '17049020', cfop: '5102', csosn: '102', cst_icms: '18,0', origem: 0, cst_pis: '49', cst_cofins: '49' })
    expect(p.cst_icms).toBeNull()
    expect(p.csosn).toBe('102')
    expect(p.ncm).toBe('17049020')
    expect(p.barcode).toBe('7895144028019')
  })
})
