import { describe, expect, it } from 'vitest'

import { apurarPeriodo, DiaDePonto, FuncionarioDaConta, minutosNoturnos } from './apuracao'
import { abaixoDaLei, REGRA_CLT, REGRA_LEGADO, RegraDaLoja, regraDoDia } from './regra'

// Horário de Brasília escrito com o fuso: o teste não depende do fuso da máquina
const brt = (iso: string) => new Date(`${iso}:00-03:00`)

function dia(data: string, entrada: string | null, saida: string | null, extra: Partial<DiaDePonto> = {}): DiaDePonto {
  return {
    data,
    entrada: entrada ? brt(entrada) : null,
    saidaIntervalo: null,
    voltaIntervalo: null,
    saida: saida ? brt(saida) : null,
    entradaExtra: null,
    saidaExtra: null,
    dobra: false,
    valorDobra: null,
    ausencia: null,
    ...extra,
  }
}

const registrado: FuncionarioDaConta = { tipo: 'REGISTERED', salario: 2200, diaria: null, valorHoraExtra: 0 } // R$ 10/h
const clt = (extra: Partial<RegraDaLoja> = {}): RegraDaLoja[] => [{ ...REGRA_CLT, vigenteDesde: '2000-01-01', ...extra }]

describe('conta única do ponto', () => {
  it('a regra antiga (7h20, 60%) dá os mesmos números que o espelho da web dava', () => {
    // Segunda 05/10/2026: 9h trabalhadas = 100 min acima de 7h20, a 60%
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', '2026-10-05T10:00', '2026-10-05T19:00')],
      feriados: [], regras: [REGRA_LEGADO], inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].trabalhadosMin).toBe(540)
    expect(r.dias[0].extraMin).toBe(100)
    expect(r.dias[0].extraSemanaMin).toBe(0)
    expect(r.dias[0].noturnosMin).toBe(0)
    expect(r.totais.valorExtra).toBe(26.67) // 10 × 1,6 × 100/60
    expect(r.totais.valorNoturno).toBe(0)
  })

  it('segunda-feira não vira domingo (defeito da conta antiga do servidor)', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', '2026-10-05T10:00', '2026-10-05T19:00')],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].domingo).toBe(false)
    expect(r.dias[0].extraEspecialMin).toBe(0)
  })

  it('CLT: tolerância de 10 min no dia; passou, conta tudo', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [
        dia('2026-10-05', '2026-10-05T09:00', '2026-10-05T17:10'), // 8h10: dentro da tolerância
        dia('2026-10-06', '2026-10-06T09:00', '2026-10-06T17:20'), // 8h20: 20 min de extra
      ],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-06',
    })
    expect(r.dias[0].extraMin).toBe(0)
    expect(r.dias[1].extraMin).toBe(20)
    expect(r.totais.valorExtra).toBe(5) // 10 × 1,5 × 20/60
  })

  it('CLT: 6 dias de 7h40 = 46h na semana: 2 horas de extra, lançadas no domingo', () => {
    const dias = ['05', '06', '07', '08', '09', '10'].map((d) =>
      dia(`2026-10-${d}`, `2026-10-${d}T10:00`, `2026-10-${d}T17:40`))
    const r = apurarPeriodo({ funcionario: registrado, dias, feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-11' })
    expect(r.dias.every((d) => d.extraMin === 0)).toBe(true)
    expect(r.dias[6].data).toBe('2026-10-11')
    expect(r.dias[6].extraSemanaMin).toBe(120)
    expect(r.totais.extraSemanaMin).toBe(120)
    expect(r.totais.valorExtra).toBe(30)
  })

  it('a semana não conta de novo o que já foi extra no dia', () => {
    // 5 dias de 9h (60 min de extra por dia) = 45h; normais = 5 × 8h = 40h: nada a mais pela semana
    const dias = ['05', '06', '07', '08', '09'].map((d) => dia(`2026-10-${d}`, `2026-10-${d}T09:00`, `2026-10-${d}T18:00`))
    const r = apurarPeriodo({ funcionario: registrado, dias, feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-11' })
    expect(r.totais.extraMin).toBe(300)
    expect(r.totais.extraSemanaMin).toBe(0)
  })

  it('semana que fecha no mês seguinte fica para o mês seguinte', () => {
    const dias = ['26', '27', '28', '29', '30'].map((d) => dia(`2026-10-${d}`, `2026-10-${d}T08:00`, `2026-10-${d}T17:30`))
    const r = apurarPeriodo({ funcionario: registrado, dias, feriados: [], regras: clt(), inicio: '2026-10-01', fim: '2026-10-31' })
    expect(r.totais.extraSemanaMin).toBe(0)
    expect(r.totais.extraMin).toBe(5 * 90)
  })

  it('domingo: só o excedente a 100%; feriado: o dia todo a 100% (CLT)', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [
        dia('2026-10-11', '2026-10-11T10:00', '2026-10-11T19:00'), // domingo, 9h
        dia('2026-10-12', '2026-10-12T10:00', '2026-10-12T16:00'), // feriado (12/10), 6h
      ],
      feriados: ['2026-10-12'], regras: clt(), inicio: '2026-10-11', fim: '2026-10-12',
    })
    expect(r.dias[0].extraEspecialMin).toBe(60)
    expect(r.dias[1].extraEspecialMin).toBe(360)
    expect(r.totais.valorExtraEspecial).toBe(140) // (60 + 360)/60 × 10 × 2
  })

  it('feriado só no excedente, quando a loja escolhe assim', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-12', '2026-10-12T10:00', '2026-10-12T19:00')],
      feriados: ['2026-10-12'], regras: clt({ feriado: 'EXCEDENTE_100' }), inicio: '2026-10-12', fim: '2026-10-12',
    })
    expect(r.dias[0].extraEspecialMin).toBe(60)
  })

  it('2ª faixa: 50% nas 2 primeiras horas extras, 70% depois', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', '2026-10-05T08:00', '2026-10-05T19:00')], // 11h = 3h de extra
      feriados: [], regras: clt({ segundaFaixaAPartirMin: 120, multiplicadorSegundaFaixa: 1.7 }), inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].extraMin).toBe(120)
    expect(r.dias[0].extraSegundaFaixaMin).toBe(60)
    expect(r.totais.valorExtra).toBe(47) // 2h × 15 + 1h × 17
  })

  it('noturno: turno das 18h às 2h com intervalo das 22h às 23h = 3h no relógio, 3h26 pagas (hora de 52min30s)', () => {
    const turno = dia('2026-10-09', '2026-10-09T18:00', '2026-10-10T02:00', {
      saidaIntervalo: brt('2026-10-09T22:00'),
      voltaIntervalo: brt('2026-10-09T23:00'),
    })
    const r = apurarPeriodo({ funcionario: registrado, dias: [turno], feriados: [], regras: clt(), inicio: '2026-10-09', fim: '2026-10-09' })
    expect(r.dias[0].trabalhadosMin).toBe(420)
    expect(r.dias[0].noturnosMin).toBe(180)
    expect(r.dias[0].noturnosPagosMin).toBe(206)
    expect(r.totais.valorNoturno).toBe(6.87) // 10 × 20% × 206/60
  })

  it('noturno: as horas aparecem mesmo com o adicional desligado (fato x valor)', () => {
    const turno = dia('2026-10-09', '2026-10-09T18:00', '2026-10-10T00:00')
    const r = apurarPeriodo({ funcionario: registrado, dias: [turno], feriados: [], regras: clt({ noturnoLigado: false }), inicio: '2026-10-09', fim: '2026-10-09' })
    expect(r.dias[0].noturnosMin).toBe(120)
    expect(r.totais.valorNoturno).toBe(0)
  })

  it('minutos noturnos atravessando a meia-noite e a manhã', () => {
    expect(minutosNoturnos(brt('2026-10-09T21:00'), brt('2026-10-10T06:00'))).toBe(420)
    expect(minutosNoturnos(brt('2026-10-09T04:00'), brt('2026-10-09T23:00'))).toBe(120)
    expect(minutosNoturnos(brt('2026-10-09T08:00'), brt('2026-10-09T17:00'))).toBe(0)
  })

  it('diarista: a hora é a diária ÷ as horas da diária; a loja pode desligar a extra (as horas continuam)', () => {
    const diarista: FuncionarioDaConta = { tipo: 'DAILY', salario: null, diaria: 120, valorHoraExtra: 0 }
    const dias = [dia('2026-10-05', '2026-10-05T10:00', '2026-10-05T19:00')] // 9h = 60 min além das 8h
    const comExtra = apurarPeriodo({ funcionario: diarista, dias, feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-05' })
    expect(comExtra.valorHora).toBe(15)
    expect(comExtra.totais.valorExtra).toBe(22.5)
    const semExtra = apurarPeriodo({ funcionario: diarista, dias, feriados: [], regras: clt({ diaristaRecebeExtra: false }), inicio: '2026-10-05', fim: '2026-10-05' })
    expect(semExtra.totais.extraMin).toBe(60)
    expect(semExtra.totais.valorExtra).toBe(0)
  })

  it('valor de hora extra combinado no cadastro manda na conta (domingo na mesma proporção)', () => {
    const combinado: FuncionarioDaConta = { ...registrado, valorHoraExtra: 30 }
    const r = apurarPeriodo({
      funcionario: combinado,
      dias: [
        dia('2026-10-05', '2026-10-05T09:00', '2026-10-05T18:00'), // 60 min de extra
        dia('2026-10-11', '2026-10-11T09:00', '2026-10-11T18:00'), // domingo: 60 min a 100%
      ],
      feriados: [], regras: clt({ contarSemana: false }), inicio: '2026-10-05', fim: '2026-10-11',
    })
    expect(r.valorHoraExtra).toBe(30)
    expect(r.totais.valorExtraNormal).toBe(30)
    expect(r.totais.valorExtraEspecial).toBe(40) // 30 × 2 ÷ 1,5
  })

  it('a regra vale a partir da data dela: o passado continua com a antiga', () => {
    const regras = [REGRA_LEGADO, { ...REGRA_CLT, vigenteDesde: '2026-10-08' }]
    expect(regraDoDia(regras, '2026-10-07').modelo).toBe('LEGADO')
    expect(regraDoDia(regras, '2026-10-08').modelo).toBe('CLT')
    expect(regraDoDia([], '2026-10-08').modelo).toBe('CLT')
  })

  it('dobra: o dia vale o combinado e fica fora da hora extra', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', '2026-10-05T09:00', '2026-10-05T21:00', { dobra: true, valorDobra: 200 })],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].situacao).toBe('DOBRA')
    expect(r.dias[0].extraMin).toBe(0)
    expect(r.totais.valorDobras).toBe(200)
    expect(r.totais.valorExtra).toBe(0)
  })

  it('atestado conta a jornada para mostrar, mas não entra na hora extra', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', null, null, { ausencia: 'ATESTADO' })],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].situacao).toBe('ATESTADO')
    expect(r.dias[0].virtuaisMin).toBe(480)
    expect(r.totais.atestados).toBe(1)
    expect(r.totais.trabalhadosMin).toBe(0)
  })

  it('avisos: mais de 10 horas, intervalo curto e menos de 11 horas entre jornadas (só avisam)', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [
        dia('2026-10-05', '2026-10-05T12:00', '2026-10-06T00:30'), // 12h30 sem intervalo
        dia('2026-10-06', '2026-10-06T08:00', '2026-10-06T15:00', {
          saidaIntervalo: brt('2026-10-06T11:00'), voltaIntervalo: brt('2026-10-06T11:30'),
        }), // 7h30 de descanso; 6h30 de trabalho com intervalo de 30 min
      ],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-06',
    })
    expect(r.dias[0].avisos.map((a) => a.tipo)).toEqual(['DIA_ACIMA_10H', 'INTERVALO_MENOR_1H'])
    expect(r.dias[1].avisos.map((a) => a.tipo)).toEqual(['INTERVALO_MENOR_1H', 'MENOS_DE_11H_ENTRE_JORNADAS'])
    expect(r.totais.avisos.DIA_ACIMA_10H).toBe(1)
    expect(r.totais.avisos.MENOS_DE_11H_ENTRE_JORNADAS).toBe(1)
  })

  it('batida fora de ordem não vira 24 horas: o trecho sai da conta e avisa (Marujo, 07/09/2026)', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-09-07', '2026-09-07T17:02', '2026-09-07T23:30', {
        saidaIntervalo: brt('2026-09-07T17:00'), voltaIntervalo: brt('2026-09-07T17:50'),
      })],
      feriados: [], regras: clt(), inicio: '2026-09-07', fim: '2026-09-07',
    })
    expect(r.dias[0].trabalhadosMin).toBe(340) // só 17:50 às 23:30
    expect(r.dias[0].avisos.map((a) => a.tipo)).toContain('BATIDA_FORA_DE_ORDEM')
  })

  it('saída de madrugada gravada no mesmo dia ainda conta como virada da meia-noite', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-09', '2026-10-09T20:00', '2026-10-09T01:00')], // 01:00 sem o "dia seguinte"
      feriados: [], regras: clt(), inicio: '2026-10-09', fim: '2026-10-09',
    })
    expect(r.dias[0].trabalhadosMin).toBe(300)
  })

  it('entrada sem saída avisa e não inventa horas', () => {
    const r = apurarPeriodo({
      funcionario: registrado,
      dias: [dia('2026-10-05', '2026-10-05T09:00', null)],
      feriados: [], regras: clt(), inicio: '2026-10-05', fim: '2026-10-05',
    })
    expect(r.dias[0].trabalhadosMin).toBe(0)
    expect(r.dias[0].avisos[0].tipo).toBe('BATIDA_INCOMPLETA')
  })

  it('sugestão da lei: a regra antiga fica abaixo do mínimo em noturno e diarista; a CLT não', () => {
    expect(abaixoDaLei(REGRA_CLT)).toEqual([])
    const antiga = abaixoDaLei(REGRA_LEGADO)
    expect(antiga.some((t) => t.includes('noturno'))).toBe(true)
    expect(antiga.some((t) => t.includes('diarista'))).toBe(true)
  })
})
