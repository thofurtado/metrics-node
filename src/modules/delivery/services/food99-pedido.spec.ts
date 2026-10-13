import { describe, expect, it } from 'vitest'
import { avisoDa99, enderecoDa99 } from './food99-pedido'

describe('endereço do pedido da 99', () => {
  it('o número vem de street_number e "casa" vira complemento (pedido real da Jessica, Katatau 13/10/2026)', () => {
    const e = enderecoDa99({
      street_name: 'Avenida Guarda Mor Lobo Viana', street_number: '642', house_number: 'casa ', complement: '', reference: 'casa',
      district: 'Centro', poi_address: 'Avenida Guarda Mor Lobo Viana, 642 - Centro, São Sebastião - SP',
    })
    expect(e.numero).toBe('642')
    expect(e.complemento).toBe('casa')
    expect(e.linha).toBe('Avenida Guarda Mor Lobo Viana, 642 (casa) - Centro')
  })

  it('sem número fica S/N; sem rua usa o endereço completo', () => {
    const e = enderecoDa99({ poi_address: 'Rua A, 10 - Centro', house_number: 'apto 12', reference: 'perto da praça' })
    expect(e.rua).toBe('Rua A, 10 - Centro')
    expect(e.numero).toBe('S/N')
    expect(e.complemento).toBe('apto 12 - perto da praça')
  })
})

describe('avisos da 99', () => {
  it('concluído fecha o pedido como entregue', () => {
    expect(avisoDa99('orderFinish')).toEqual({ tipo: 'situacao', situacao: { status: 'Fechado', status_delivery: 'Entregue' } })
  })
  it('cancelado é tratado à parte; aviso da loja não mexe em pedido', () => {
    expect(avisoDa99('orderCancel')).toEqual({ tipo: 'cancelado' })
    expect(avisoDa99('shopStatus')).toBeNull()
    expect(avisoDa99('orderNew')).toBeNull()
  })
})
