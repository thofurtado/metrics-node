/**
 * Códigos fiscais do produto no formato que a NFC-e e o PDV aceitam. Valor fora do formato vira null: o PDV não consegue
 * gravá-lo e a nota seria recusada.
 *
 * Por que (09/10/2026, Katatau): o Metrics.Sync lia a alíquota do ICMS ("18,0") no lugar do CST quando o produto não tinha a
 * tributação preenchida no Athos. A coluna cst_icms do PDV tem 3 caracteres, e um único produto assim travava a sincronização
 * do cardápio inteiro ("An error occurred while saving the entity changes"). Na Katatau também havia 2.359 produtos com "II"
 * (o código de "Isento" da impressora fiscal antiga do Athos, que não é CST) e 2 com "18" (a alíquota).
 * Na entrada (envio do Sync) um valor ruim não entra, mas o que já está gravado na nuvem fica; na saída (cardápio e produtos do
 * PDV) tudo sai limpo, para que nenhum dado ruim chegue ao caixa. O CST do ICMS e o CSOSN só aceitam os códigos da tabela oficial.
 */

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim()
const semPontos = (v: unknown): string => texto(v).replace(/[.\s-]/g, '')

// Tabelas oficiais da NF-e/NFC-e (Manual de Orientação do Contribuinte): CST do ICMS (tabela B) e CSOSN do Simples Nacional
const CSTS_ICMS = new Set(['00', '02', '10', '15', '20', '30', '40', '41', '50', '51', '53', '60', '61', '70', '90'])
const CSOSNS = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'])

/** CST do ICMS da tabela oficial: 2 dígitos (00, 20, 60...) ou 3 com a origem (0 a 8) na frente. "II" e "18" não são CST. */
export function cstIcmsValido(v: unknown): string | null {
    const t = texto(v)
    if (t.length === 2) return CSTS_ICMS.has(t) ? t : null
    if (t.length === 3) return /^[0-8]$/.test(t[0]) && CSTS_ICMS.has(t.slice(1)) ? t : null
    return null
}

/** CSOSN do Simples Nacional da tabela oficial (101, 102, 103, 201, 202, 203, 300, 400, 500, 900). */
export function csosnValido(v: unknown): string | null {
    const t = texto(v)
    return CSOSNS.has(t) ? t : null
}

/** CFOP: 4 dígitos; aceita com ponto ("5.102") e grava sem. */
export function cfopValido(v: unknown): string | null {
    const t = semPontos(v)
    return /^\d{4}$/.test(t) ? t : null
}

/** NCM: só dígitos, até 8; aceita com pontos ("2106.90.90") e grava sem. */
export function ncmValido(v: unknown): string | null {
    const t = semPontos(v)
    return /^\d{2,8}$/.test(t) ? t : null
}

/** CEST: 7 dígitos; aceita com pontos ("17.049.00") e grava sem. */
export function cestValido(v: unknown): string | null {
    const t = semPontos(v)
    return /^\d{7}$/.test(t) ? t : null
}

/** CST do PIS e do COFINS: 2 dígitos. */
export function cstPisCofinsValido(v: unknown): string | null {
    const t = texto(v)
    return /^\d{2}$/.test(t) ? t : null
}

/** Código de barras: até 50 caracteres (o tamanho da coluna do PDV), sem espaços nas pontas. */
export function codigoBarrasValido(v: unknown): string | null {
    const t = texto(v)
    return t && t.length <= 50 ? t : null
}

/** Origem da mercadoria: 0 a 8 (tabela da NF-e); qualquer outra coisa vira 0 (nacional). */
export function origemValida(v: unknown): number {
    const n = Number(texto(v))
    return Number.isInteger(n) && n >= 0 && n <= 8 ? n : 0
}

type ComFiscais = {
    barcode?: unknown; ncm?: unknown; cest?: unknown; cfop?: unknown; csosn?: unknown; cst_icms?: unknown
    origem?: unknown; cst_pis?: unknown; cst_cofins?: unknown
}

/** Os campos fiscais de um produto já limpos, para a saída (cardápio e produtos do PDV). */
export function fiscaisLimpos(p: ComFiscais) {
    return {
        barcode: codigoBarrasValido(p.barcode),
        ncm: ncmValido(p.ncm),
        cest: cestValido(p.cest),
        cfop: cfopValido(p.cfop),
        csosn: csosnValido(p.csosn),
        cst_icms: cstIcmsValido(p.cst_icms),
        origem: origemValida(p.origem),
        cst_pis: cstPisCofinsValido(p.cst_pis),
        cst_cofins: cstPisCofinsValido(p.cst_cofins),
    }
}
