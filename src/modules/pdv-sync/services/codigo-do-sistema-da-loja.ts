/**
 * O código do sistema da loja manda (16/10/2026, Katatau, regra do Thomás): o código do produto no Metrics (display_id) é o
 * mesmo do sistema antigo da loja (Athos: idproduto), não pode haver produto a mais e o Sync deixa a nuvem igual ao Athos.
 *
 * Antes, o envio em lote do Sync procurava o produto pelo NOME ou pelo código de barras e só depois mexia no código: na
 * Katatau ficaram 149 produtos com código errado (148 na faixa 900.000, cópias de produtos do Athos), 75 códigos apontando
 * para outro produto (o 137 da nuvem era "Alvejante Saif"; no Athos o 137 é "Chocolate em pó Neilar") e 167 produtos ativos
 * do Athos sem o seu código na nuvem. Agora o envio acha o produto pelo código; e o "espelho" desativa o que não existe mais
 * no Athos (ver planoDoEspelho). Regras puras, sem banco, para os testes.
 */

/** Faixa para onde vai o produto JÁ USADO que sai do código do Athos (fica inativo, com o histórico). */
export const INICIO_FAIXA_AFASTADOS = 900000

/**
 * Faixa dos produtos criados direto no Metrics só para as plataformas (iFood/99) e que não existem no sistema da loja (17/10/2026,
 * Katatau: pacotes de pão, frios de 100 g, omeletes por sabor; regra do Thomás: um produto do Metrics = um item em cada plataforma).
 * O espelho não desativa nem conta esses códigos; o Athos numera bem abaixo e o 900.000 é dos afastados.
 */
export const FAIXA_DAS_PLATAFORMAS = { de: 800000, ate: 899999 } as const

/** O código é da faixa dos produtos só das plataformas (o espelho do Athos não mexe nele). */
export const ehDaFaixaDasPlataformas = (codigo: number): boolean => codigo >= FAIXA_DAS_PLATAFORMAS.de && codigo <= FAIXA_DAS_PLATAFORMAS.ate

/** Trava do espelho: a lista do Athos tem que ter o código de pelo menos 80% dos produtos ativos da nuvem. */
export const COBERTURA_MINIMA_DO_ESPELHO = 0.8

const PALAVRAS_VAZIAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'COM', 'SEM', 'EM', 'NO', 'NA', 'PARA'])

/** Maiúsculas, sem acento, só letras e números; "500 G" vira "500G" (número junto da unidade). */
export function nomeNormalizado(nome: string | null | undefined): string {
    return (nome ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .replace(/(\d)\s+(?=[A-Z])/g, '$1')
        .trim()
        .replace(/\s+/g, ' ')
}

function palavras(nome: string | null | undefined): string[] {
    return [...new Set(nomeNormalizado(nome).split(' ').filter((w) => w.length > 1 && !PALAVRAS_VAZIAS.has(w)))]
}

const temNumero = (w: string) => /\d/.test(w)

/** Mesma palavra, ou abreviação com 3 letras ou mais ("REF" e "REFINADO"). Palavra com número só vale igual ("2L" x "600ML"). */
function combinam(a: string, b: string): boolean {
    if (a === b) return true
    if (temNumero(a) || temNumero(b)) return false
    return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))
}

function codigoDeBarras(v: string | null | undefined): string | null {
    const t = (v ?? '').trim()
    return /^\d{8,14}$/.test(t) ? t : null
}

/**
 * O nome que chegou do Athos para o código é do MESMO produto que está na nuvem nesse código (só foi corrigido ou
 * completado) ou de OUTRO produto? Para produto já usado (vendido, em pedido ou com vínculo de plataforma) a nuvem compara só
 * o NOME (barras nulos): as vendas e os pedidos guardam o id do produto e não o nome, então renomear muda o nome no histórico.
 * Para produto nunca usado, o código de barras também conta (decide se o cadastro é mantido ou refeito com os dados do Athos).
 *
 * Mesmo produto: o mesmo código de barras; o mesmo nome sem acento e pontuação; um nome contém o outro (2 palavras ou mais:
 * "RODO PASSA CERA MJ" e "RODO PASSA CERA MJ 30CM"); ou pelo menos metade das palavras em comum. Tamanhos diferentes
 * ("COCA COLA 2L" x "COCA COLA 600ML") são outro produto. Exemplos da Katatau: "CAFE PEQUENO PRETO" x "PO DE CAFE UNIAO
 * EXTRAFORTE 500 G" e "MOUSSE GRANDE UNID" x "SNICKERS MOUSSE DE MARACUJA 42G" são outro produto.
 */
export function mesmoProduto(nomeA: string | null | undefined, barrasA: string | null | undefined,
    nomeB: string | null | undefined, barrasB: string | null | undefined): boolean {
    const bA = codigoDeBarras(barrasA)
    const bB = codigoDeBarras(barrasB)
    if (bA && bB && bA === bB) return true
    if (nomeNormalizado(nomeA) === nomeNormalizado(nomeB)) return true

    const a = palavras(nomeA)
    const b = palavras(nomeB)
    if (a.length === 0 || b.length === 0) return false

    const numerosA = a.filter(temNumero)
    const numerosB = b.filter(temNumero)
    if (numerosA.length > 0 && numerosB.length > 0 && !numerosA.some((n) => numerosB.includes(n))) return false

    const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
    const livres = [...maior]
    let emComum = 0
    for (const w of menor) {
        const i = livres.findIndex((x) => combinam(w, x))
        if (i >= 0) {
            emComum++
            livres.splice(i, 1)
        }
    }
    if (menor.length >= 2 && emComum === menor.length) return true
    return emComum / (a.length + b.length - emComum) >= 0.5
}

export interface ProdutoDaNuvemNoEspelho {
    id: string
    display_id: number
    name: string
    active: boolean | null
}

export interface CodigoDoSistemaDaLoja {
    codigo: number
    ativo: boolean
}

export interface PlanoDoEspelho {
    /** Códigos diferentes na lista do Athos. */
    codigosNaLista: number
    /** Produtos ativos na nuvem antes do espelho. */
    ativosNaNuvem: number
    /** Produtos ativos da nuvem cujo código está na lista do Athos. */
    cobertos: number
    /** cobertos / ativosNaNuvem (1 quando a nuvem não tem produto ativo). */
    cobertura: number
    /** Trava: lista vazia, ou menos de 80% dos produtos ativos da nuvem estão na lista (Athos lido pela metade?). */
    recusar: boolean
    /** Ativos na nuvem com um código que não existe no Athos: vão para inativo. */
    foraDoSistema: ProdutoDaNuvemNoEspelho[]
    /** Ativos na nuvem com um código que no Athos está inativo: vão para inativo. */
    inativosNoSistema: ProdutoDaNuvemNoEspelho[]
}

/**
 * O que o espelho do Athos faz na nuvem: produto ATIVO da nuvem cujo código não está na lista completa do Athos, ou está
 * inativo lá, vai para inativo. Nunca apaga (o PDV só enxerga o que muda por updated_at, e as vendas apontam para o produto)
 * e nunca ativa (quem ativa é o envio do produto). Produto já inativo na nuvem fica como está.
 * Produto da faixa das plataformas (FAIXA_DAS_PLATAFORMAS) não entra: ele não existe no Athos de propósito.
 */
export function planoDoEspelho(naNuvem: ProdutoDaNuvemNoEspelho[], lista: CodigoDoSistemaDaLoja[]): PlanoDoEspelho {
    const ativoNoSistema = new Map<number, boolean>()
    for (const c of lista) ativoNoSistema.set(c.codigo, (ativoNoSistema.get(c.codigo) ?? false) || c.ativo)

    // Produto só das plataformas (faixa 800.000) não existe no Athos de propósito: fica fora do espelho e da conta da trava
    const ativos = naNuvem.filter((p) => p.active !== false && !ehDaFaixaDasPlataformas(p.display_id))
    const foraDoSistema = ativos.filter((p) => !ativoNoSistema.has(p.display_id))
    const inativosNoSistema = ativos.filter((p) => ativoNoSistema.get(p.display_id) === false)
    const cobertos = ativos.length - foraDoSistema.length
    const cobertura = ativos.length > 0 ? cobertos / ativos.length : 1

    return {
        codigosNaLista: ativoNoSistema.size,
        ativosNaNuvem: ativos.length,
        cobertos,
        cobertura,
        recusar: ativoNoSistema.size === 0 || cobertura < COBERTURA_MINIMA_DO_ESPELHO,
        foraDoSistema,
        inativosNoSistema,
    }
}
