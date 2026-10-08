// Leitura da regra da loja no intervalo entre a publicação do servidor e o "Sincronizar" do SaaS Admin (08/10/2026).
// O banco é simulado: este teste não conecta em nada.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { hrRuleHistory: { findMany: (...a: unknown[]) => findMany(...a) } } }))

const { carregarRegras, faltamColunasDaRegra } = await import('./servico')

describe('regra da loja antes e depois do Sincronizar', () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  it('sem as colunas novas, a conta segue com a regra antiga (o ponto não para)', async () => {
    findMany.mockImplementation(async () => {
      throw Object.assign(new Error('The column `hr_rule_histories.model_key` does not exist in the current database.'), { code: 'P2022' })
    })
    const regras = await carregarRegras()
    expect(regras).toHaveLength(1)
    expect(regras[0].modelo).toBe('LEGADO')
    expect(regras[0].multiplicadorExtra).toBe(1.6)
    expect(regras[0].jornadaDiariaMin).toBe(440)
  })

  it('outro erro do banco não é escondido', async () => {
    findMany.mockImplementation(async () => {
      throw Object.assign(new Error('Can\'t reach database server'), { code: 'P1001' })
    })
    await expect(carregarRegras()).rejects.toThrow('reach database')
  })

  it('reconhece a falta de coluna pela mensagem quando não vem o código', () => {
    expect(faltamColunasDaRegra(new Error('column hr_rule_histories.sunday_mode does not exist'))).toBe(true)
    expect(faltamColunasDaRegra(new Error('column employees.foo does not exist'))).toBe(false)
    expect(faltamColunasDaRegra(null)).toBe(false)
  })

  it('com as colunas, devolve as linhas do banco', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1', valid_from: new Date('2000-01-01T00:00:00Z'), he_divisor: 220, he_multiplier_standard: 1.7, he_multiplier_special: 2,
        daily_workload_minutes: 440, tolerance_minutes: 10, model_key: 'PERSONALIZADO', weekly_workload_minutes: 2640,
        count_weekly: false, second_tier_after_minutes: null, he_multiplier_second_tier: null, sunday_mode: 'EXCEDENTE_100',
        holiday_mode: 'DIA_TODO_100', night_enabled: false, night_additional: 0.2, night_reduced_hour: true,
        daily_rate_minutes: 440, daily_workers_overtime: false, notes: null,
      },
    ])
    const regras = await carregarRegras()
    expect(regras[0].modelo).toBe('PERSONALIZADO')
    expect(regras[0].multiplicadorExtra).toBe(1.7)
  })
})
