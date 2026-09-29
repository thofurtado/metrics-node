/**
 * Dia de competência do Ponto: a batida antes das 04:00 de Brasília conta para o dia anterior (decisão do Thomás,
 * 29/09/2026: ninguém entra antes das 4h e quase ninguém sai depois das 4h).
 *
 * Antes a regra era "antes das 7h" pelo relógio do SERVIDOR. Com o servidor em UTC, isso dava 04:00 de Brasília; quando o
 * servidor passou a rodar no horário de Brasília (2.6.76, 23/09/2026), virou 07:00 e a entrada das 06:23 caiu no dia
 * anterior como "entrada extra". Agora a conta é feita em Brasília de forma explícita, sem depender do fuso do servidor.
 * O Ponto NÃO usa o dia operacional do caixa (05:00, src/lib/dia-operacional.ts).
 *
 * Devolve a meia-noite UTC do dia de competência (compatível com coluna @db.Date do Prisma).
 * O Brasil não tem horário de verão desde 2019, então Brasília é sempre UTC-3.
 */
export const HORA_DA_VIRADA_DO_PONTO = 4
const OFFSET_BRASILIA_HORAS = -3
const HORA_MS = 60 * 60 * 1000

export function getCompetenceDate(timestamp: Date = new Date()): Date {
    const deslocado = new Date(timestamp.getTime() + (OFFSET_BRASILIA_HORAS - HORA_DA_VIRADA_DO_PONTO) * HORA_MS)
    return new Date(Date.UTC(
        deslocado.getUTCFullYear(),
        deslocado.getUTCMonth(),
        deslocado.getUTCDate()
    ))
}
