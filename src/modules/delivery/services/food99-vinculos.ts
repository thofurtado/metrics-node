/**
 * Vínculo dos itens do cardápio da 99Food com os produtos do Metrics (12/10/2026, Katatau). O cardápio da loja foi montado
 * direto na 99: os 88 itens vêm com app_item_id VAZIO e a lista não traz outro código da 99 (conferido em 12/10/2026). Então:
 * - o código do vínculo de um item sem app_item_id é o NOME normalizado ("nome:coca cola lata 350ml"), que é o mesmo nome que
 *   chega no pedido (order_items[].name);
 * - a tela sugere o produto de cada item pelo nome (palavras em comum), para a loja confirmar.
 */

/** Texto sem acento, minúsculo, só letras/números e espaços, com unidades juntas ("350 ml" -> "350ml"). */
export function normalizarNome(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/c\//g, 'com ')
    .replace(/s\//g, 'sem ')
    .replace(/(\d+)\s*(ml|g|kg|l|lt|litros?)\b/g, (_m, n, u) => `${n}${/^l/.test(u) ? 'l' : u}`)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Código do vínculo do item da 99: o app_item_id quando existe; senão o nome normalizado. */
export function chaveDoItem99(appItemId: unknown, nome: unknown): string {
  const id = String(appItemId ?? '').trim()
  if (id) return id
  const n = normalizarNome(nome)
  return n ? `nome:${n}`.slice(0, 190) : ''
}

const PARAR = new Set('de do da e a o com top mais unid un oferta simples refrigerante original lata porcao acomp extra'.split(' '))
const SINONIMOS: Record<string, string> = { cola: 'coca', mucarella: 'mussarela', mucarela: 'mussarela', antarctica: 'antartica', ovos: 'ovo' }
// Palavras que mudam o produto: se uma das duas pontas tem e a outra não, não é o mesmo produto ("Pão sem chapa" não é
// "Pão na chapa"; "Guaraná zero" não é o guaraná comum; "Misto frio" não é "Misto quente"). Conferido com a Katatau em 12/10/2026.
const DECISIVAS = new Set(['zero', 'diet', 'light', 'sem', 'frio', 'quente'])

function palavras(texto: string): string[] {
  const out: string[] = []
  const limpo = normalizarNome(texto)
    .replace(/\btop \d+ mais\b/g, ' ') // "Top 3 Mais !" é chamada de venda da 99
    .replace(/\b\d+ unid\w*\b/g, ' ') // "06 Unid." é a quantidade do pacote, não o produto
  for (const w of limpo.split(' ')) {
    const singular = w.length >= 4 && w.endsWith('s') && !/\d/.test(w) ? w.slice(0, -1) : w // "iscas" = "isca"
    const p = SINONIMOS[singular] ?? singular
    if (!p || PARAR.has(p) || (p.length < 2 && p !== 'x' && !/\d/.test(p))) continue
    if (!out.includes(p)) out.push(p)
  }
  return out
}

export interface ProdutoParaSugerir { id: string; name: string; display_id: number }

function melhorProduto(base: string, produtos: { p: ProdutoParaSugerir; tk: Set<string> }[]): ProdutoParaSugerir | null {
  const lista = palavras(base)
  if (lista.length === 0) return null
  const alvo = new Set(lista)
  const cabeca = lista[0] // a 1ª palavra diz o que é o prato ("Omelete de presunto" não é "Duo presunto+queijo")
  let melhor: { p: ProdutoParaSugerir; s: number } | null = null
  let segundo = 0
  for (const { p, tk } of produtos) {
    if (!tk.has(cabeca)) continue
    let decisivaDiferente = false
    for (const w of DECISIVAS) if (alvo.has(w) !== tk.has(w)) { decisivaDiferente = true; break }
    if (decisivaDiferente) continue
    let comum = 0
    for (const w of alvo) if (tk.has(w)) comum++
    let extra = 0
    for (const w of tk) if (!alvo.has(w)) extra++
    // Troca de palavra dos dois lados é outro produto: "Isca de frango" x "Isca de carne", "Coca 600 ml" x "Coca 2 l".
    if (extra > 0 && comum < alvo.size) continue
    const s = comum / (alvo.size + 0.5 * extra)
    if (!melhor || s > melhor.s) { segundo = melhor?.s ?? 0; melhor = { p, s } }
    else if (s > segundo) segundo = s
  }
  if (!melhor || melhor.s < 0.5 || melhor.s - segundo < 0.05) return null
  return melhor.p
}

const preparados = new WeakMap<ProdutoParaSugerir[], { p: ProdutoParaSugerir; tk: Set<string> }[]>()

/**
 * Produto mais parecido pelo nome, ou null quando nenhum é parecido o bastante (a loja escolhe à mão). Regras: a 1ª palavra
 * do item tem de estar no produto; palavras decisivas (zero, sem, frio...) têm de bater; pelo menos metade das palavras em
 * comum; e o 1º colocado tem de ganhar do 2º. Nome fantasia com o prato entre parênteses ("Hoje Pode ( X Salada )") tenta o
 * nome inteiro e, sem resultado, o que está dentro dos parênteses.
 */
export function sugerirProduto(nomeNa99: string, produtos: ProdutoParaSugerir[]): ProdutoParaSugerir | null {
  // A mesma lista de produtos serve para todos os itens do cardápio: as palavras de cada produto são calculadas uma vez só.
  let comPalavras = preparados.get(produtos)
  if (!comPalavras) {
    comPalavras = produtos.map(p => ({ p, tk: new Set(palavras(p.name)) }))
    preparados.set(produtos, comPalavras)
  }
  const pelaNomeInteiro = melhorProduto(nomeNa99, comPalavras)
  if (pelaNomeInteiro) return pelaNomeInteiro
  const dentro = /\(([^)]*)\)/.exec(nomeNa99)?.[1] ?? ''
  if (!dentro) return null
  // Só usa os parênteses quando eles têm um lanche ("( X Calabresa )") ou quando o nome de fora é fantasia (nenhum produto
  // tem a 1ª palavra dele, "Mounjaro"); "Omelete ( Presunto & Queijo )" não, porque presunto com queijo é outro produto.
  const fora = palavras(nomeNa99.replace(/\([^)]*\)/g, ' ')).filter(w => !DECISIVAS.has(w))
  const lanche = palavras(dentro)[0] === 'x'
  if (!lanche && fora.length > 0 && comPalavras.some(c => c.tk.has(fora[0]))) return null
  return melhorProduto(dentro, comPalavras)
}
