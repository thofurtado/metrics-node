/**
 * Faz o parse de JSON preservando inteiros longos (64 bits), como os IDs da 99Food.
 *
 * O JSON.parse padrão arredonda números acima de 2^53 (ex.: 5764607801871631353 vira 5764607801871631000).
 * Aqui todo inteiro com 16 dígitos ou mais, fora de strings, é convertido para string ANTES do parse.
 * Valores pequenos (preços em centavos, quantidades, timestamps) continuam numéricos.
 */
const TOKEN = /"(?:[^"\\]|\\.)*"|(-?\d{16,})(?![\d.eE])/g

export function parseJsonKeepingLongIds(text: string): any {
  const safe = text.replace(TOKEN, (match, digits) => (digits ? `"${digits}"` : match))
  return JSON.parse(safe)
}
