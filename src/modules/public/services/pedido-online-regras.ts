/**
 * Regras do pedido do cardápio online conferidas pela NUVEM (Mergulho 06:C4 e 06:C6, 15/10/2026).
 *
 * Antes a nuvem gravava o preço, o total e a hora que o navegador mandava: quem mexesse na requisição pedia um prato de
 * R$ 80 por R$ 1, ou pedia de madrugada com a loja fechada. Agora a nuvem refaz a conta com o que está cadastrado.
 *
 * São as MESMAS regras que o cliente vê no cardápio (se mudar lá, mude aqui e nos testes):
 * - preço do item = preço do produto; pizza em frações = o sabor MAIS CARO (components/ItemCustomizerDialog.tsx);
 * - complementos: em grupo com "N grátis", os N mais baratos escolhidos saem de graça (lib/complementos-gratis.ts);
 * - meia porção do cardápio do Marujo = 65% do preço (Marujo/MarujoMenu.tsx);
 * - taxa de entrega: 1º setor cujo bairro bate (igual ou contido) ou a taxa padrão (GenericMenu.tsx, findDeliverySector);
 * - loja aberta: pausa manual e horários do dia (GenericMenu.tsx, checkIsOpen), no horário de Brasília.
 */

/** Diferença de até R$ 0,01 é arredondamento do navegador, não divergência. */
export const TOLERANCIA_CENTAVOS = 1
/** Quem começou o pedido antes de fechar ainda consegue terminar: 15 min depois do horário de fechar. */
export const TOLERANCIA_FECHAMENTO_MIN = 15
/** Meia porção do cardápio do Marujo (Marujo/MarujoMenu.tsx: `customizingProduct.price * 0.65`). */
export const FATOR_MEIA_PORCAO = 0.65

const OFFSET_BRASILIA_MIN = -180 // o Brasil não tem horário de verão desde 2019

export function normalizar(texto?: string | null): string {
    return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function centavos(valor: number): number {
    return Math.round((Number(valor) || 0) * 100)
}

export function arredondar2(valor: number): number {
    return centavos(valor) / 100
}

function difere(a: number, b: number): boolean {
    return Math.abs(centavos(a) - centavos(b)) > TOLERANCIA_CENTAVOS
}

// ------------------------------------------------------------------------------------------------------------------
// Horário de funcionamento (06:C4)
// ------------------------------------------------------------------------------------------------------------------

export interface TurnoLoja {
    dayOfWeek: number
    openTime?: string | null
    closeTime?: string | null
    isOpen?: boolean | null
}

export interface PerfilHorario {
    isOpenManual?: boolean | null
    businessHours?: TurnoLoja[] | null
}

function paraMinutos(hhmm?: string | null): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec((hhmm || '').trim())
    if (!m) return null
    const horas = Number(m[1])
    const minutos = Number(m[2])
    if (horas > 24 || minutos > 59) return null
    return horas * 60 + minutos
}

function relogioDeBrasilia(instante: Date): { dia: number; minutos: number } {
    const d = new Date(instante.getTime() + OFFSET_BRASILIA_MIN * 60_000)
    return { dia: d.getUTCDay(), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

/**
 * A loja aceita pedido agora? Mesma leitura do cardápio (checkIsOpen), com duas folgas a favor do cliente para nunca
 * recusar um pedido que o cardápio deixou fazer: 15 min depois do fechamento (quem estava no meio do pedido) e a
 * madrugada de um turno que vira o dia (18:00 às 02:00 de sexta vale até 02:00 de sábado, mesmo com sábado fechado).
 */
export function situacaoDaLoja(
    perfil: PerfilHorario | null | undefined,
    agora: Date = new Date(),
    toleranciaMin: number = TOLERANCIA_FECHAMENTO_MIN,
): { aberta: boolean; motivo: string } {
    if (!perfil) return { aberta: true, motivo: 'Aberto' }
    if (perfil.isOpenManual === false) {
        return { aberta: false, motivo: 'A loja pausou os pedidos online agora.' }
    }

    const { dia, minutos } = relogioDeBrasilia(agora)
    const ontem = (dia + 6) % 7
    const turnos = (perfil.businessHours || []).filter((t) => t && t.isOpen)

    const cobre = (turno: TurnoLoja, ehDeOntem: boolean): boolean => {
        const abre = paraMinutos(turno.openTime)
        const fecha = paraMinutos(turno.closeTime)
        if (abre === null || fecha === null) return false
        if (fecha > abre) {
            // Turno no mesmo dia (ex.: 12:00 às 16:00)
            if (ehDeOntem) return minutos + 1440 <= fecha + toleranciaMin
            return minutos >= abre && minutos <= fecha + toleranciaMin
        }
        // Turno que vira a madrugada (ex.: 18:00 às 02:00, 18:00 às 00:00)
        if (ehDeOntem) return minutos <= fecha + toleranciaMin
        // O cardápio também aceita a madrugada do próprio dia (currentTime <= closeTime): mantido igual
        return minutos >= abre || minutos <= fecha + toleranciaMin
    }

    const abertaAgora =
        turnos.some((t) => t.dayOfWeek === dia && cobre(t, false)) ||
        turnos.some((t) => t.dayOfWeek === ontem && cobre(t, true))
    if (abertaAgora) return { aberta: true, motivo: 'Aberto' }

    const turnosDeHoje = turnos.filter((t) => t.dayOfWeek === dia)
    if (turnosDeHoje.length === 0) {
        return { aberta: false, motivo: 'A loja não abre hoje para pedidos online.' }
    }
    const proximo = turnosDeHoje
        .map((t) => ({ t, abre: paraMinutos(t.openTime) }))
        .filter((x) => x.abre !== null && (x.abre as number) > minutos)
        .sort((a, b) => (a.abre as number) - (b.abre as number))[0]
    if (proximo) {
        return { aberta: false, motivo: `A loja está fechada agora. Abre às ${proximo.t.openTime}.` }
    }
    return { aberta: false, motivo: 'A loja já fechou por hoje.' }
}

// ------------------------------------------------------------------------------------------------------------------
// Taxa de entrega por bairro (mesma regra do cardápio)
// ------------------------------------------------------------------------------------------------------------------

export interface PerfilEntrega {
    deliveryFee?: number | string | null
    deliverySectors?: unknown
}

function lerListaDeSetores(bruto: unknown): any[] {
    let lista: unknown = bruto
    if (typeof lista === 'string') {
        try {
            lista = JSON.parse(lista)
        } catch {
            lista = []
        }
    }
    return Array.isArray(lista) ? lista : []
}

/** Igual ao `parseDeliveryFee` do cardápio. */
export function lerTaxa(valor: unknown, padrao = 0): number {
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor
    const limpo = String(valor ?? '').replace(/[^0-9,.-]/g, '').replace(',', '.')
    const numero = Number(limpo)
    return limpo !== '' && Number.isFinite(numero) ? numero : padrao
}

export function politicaDeBairros(perfil: PerfilEntrega | null | undefined): 'STRICT' | 'FALLBACK' {
    const politica = lerListaDeSetores(perfil?.deliverySectors).find((s: any) => s?._type === 'neighborhood_policy')
    return politica?.mode === 'STRICT' ? 'STRICT' : 'FALLBACK'
}

/** Setores de verdade (sem as entradas de configuração `_type` que moram na mesma lista). */
export function setoresDeEntrega(perfil: PerfilEntrega | null | undefined): any[] {
    return lerListaDeSetores(perfil?.deliverySectors).filter((s: any) => s && typeof s === 'object' && !s._type)
}

/**
 * O setor do bairro, como o cardápio acha (`findDeliverySector`): o 1º setor com um bairro igual, ou um contendo o
 * outro ("Copacabana" acha "Balneário Copacabana"). Nome de bairro vazio na lista é ignorado (no cardápio ele casaria
 * com qualquer bairro; lá também foi corrigido).
 */
export function setorDoBairro(perfil: PerfilEntrega | null | undefined, bairro: string): any | null {
    const alvo = normalizar(bairro)
    if (!alvo) return null
    return (
        setoresDeEntrega(perfil).find(
            (setor: any) =>
                Array.isArray(setor?.neighborhoods) &&
                setor.neighborhoods.some((nome: unknown) => {
                    const n = normalizar(String(nome ?? ''))
                    return !!n && (n === alvo || n.includes(alvo) || alvo.includes(n))
                }),
        ) || null
    )
}

/** Taxa que o cardápio mostrou para o bairro e se o bairro é atendido (política STRICT só aceita bairro de setor). */
export function taxaDeEntrega(
    perfil: PerfilEntrega | null | undefined,
    bairro: string,
): { taxa: number; setor: any | null; atendido: boolean } {
    const setor = setorDoBairro(perfil, bairro)
    const taxa = setor && setor.fee !== undefined ? lerTaxa(setor.fee) : lerTaxa(perfil?.deliveryFee)
    const temBairrosNosSetores = setoresDeEntrega(perfil).some(
        (s: any) => Array.isArray(s?.neighborhoods) && s.neighborhoods.some((n: unknown) => normalizar(String(n ?? ''))),
    )
    const atendido = politicaDeBairros(perfil) !== 'STRICT' || !temBairrosNosSetores || setor !== null
    return { taxa, setor, atendido }
}

// ------------------------------------------------------------------------------------------------------------------
// Preço dos itens (06:C6)
// ------------------------------------------------------------------------------------------------------------------

export interface OpcaoCatalogo {
    id: string
    name: string
    price: number
}

export interface GrupoCatalogo {
    id: string
    name: string
    free_quantity: number
    options: OpcaoCatalogo[]
}

export interface ProdutoCatalogo {
    id: string
    name: string
    price: number
    category_id: string | null
    accepts_fractions: boolean
    grupos: GrupoCatalogo[]
}

export interface ItemEnviado {
    product_id?: string
    name?: string
    quantity: number
    unit_price: number
    complements?: unknown
    fractions?: unknown
    /** Cardápio do Marujo: meia porção (65% do preço). */
    meia_porcao?: boolean | null
}

export interface ComplementoConferido {
    group_id: string
    option_id: string
    name: string
    price: number
    quantity: number
}

export interface ItemConferido {
    indice: number
    produto: ProdutoCatalogo
    quantidade: number
    unitarioNavegador: number
    unitarioNuvem: number
    complementos: ComplementoConferido[]
    sabores: string[]
}

export interface ProblemaDoItem {
    indice: number
    tipo: 'item_desconhecido' | 'complemento_desconhecido' | 'sabor_desconhecido' | 'quantidade_invalida'
    detalhe: string
}

export interface Catalogo {
    porId: Map<string, ProdutoCatalogo>
    /** Produtos que podem ser sabor de pizza em frações (subcategoria aceita frações), para achar sabor pelo nome. */
    fracionaveis: ProdutoCatalogo[]
}

/** Regra do "N grátis" (igual a lib/complementos-gratis.ts da web e ao PDV): os N mais baratos escolhidos saem de graça. */
export function valorCobradoDoGrupo(escolhas: { preco: number; quantidade: number }[], gratis: number): number {
    const unidades: number[] = []
    for (const escolha of escolhas) {
        for (let i = 0; i < Math.max(0, escolha.quantidade || 0); i++) unidades.push(escolha.preco || 0)
    }
    unidades.sort((a, b) => a - b)
    return unidades.slice(Math.max(0, gratis || 0)).reduce((soma, preco) => soma + preco, 0)
}

function listaDeObjetos(bruto: unknown): Record<string, any>[] {
    return Array.isArray(bruto) ? bruto.filter((x) => x && typeof x === 'object') : []
}

function acharOpcao(
    produto: ProdutoCatalogo,
    enviado: Record<string, any>,
): { grupo: GrupoCatalogo; opcao: OpcaoCatalogo } | null {
    const idOpcao = typeof enviado.option_id === 'string' ? enviado.option_id : null
    const idGrupo = typeof enviado.group_id === 'string' ? enviado.group_id : null
    if (idOpcao) {
        for (const grupo of produto.grupos) {
            const opcao = grupo.options.find((o) => o.id === idOpcao)
            if (opcao) return { grupo, opcao }
        }
    }
    // Cardápio aberto antes desta versão manda só o nome: procura pelo nome nos grupos do produto (na ordem do cardápio)
    const nome = normalizar(enviado.name ?? enviado.optionName)
    if (!nome) return null
    const grupos = idGrupo ? [...produto.grupos].sort((a, b) => Number(b.id === idGrupo) - Number(a.id === idGrupo)) : produto.grupos
    for (const grupo of grupos) {
        const opcao = grupo.options.find((o) => normalizar(o.name) === nome)
        if (opcao) return { grupo, opcao }
    }
    return null
}

function acharSabor(base: ProdutoCatalogo, enviado: Record<string, any>, catalogo: Catalogo): ProdutoCatalogo | null {
    const id = typeof enviado.flavor_id === 'string' ? enviado.flavor_id : null
    if (id && catalogo.porId.has(id)) return catalogo.porId.get(id)!
    const nome = normalizar(enviado.name)
    if (!nome) return null
    if (normalizar(base.name) === nome) return base
    const candidatos = catalogo.fracionaveis.filter((p) => normalizar(p.name) === nome)
    return candidatos.find((p) => p.category_id === base.category_id) || candidatos[0] || null
}

/**
 * Refaz o preço de cada item com o cadastro da loja. Não decide nada: devolve os itens conferidos e os problemas, e
 * quem chama decide (ver create-online-order.ts).
 */
export function conferirItens(itens: ItemEnviado[], catalogo: Catalogo): { itens: ItemConferido[]; problemas: ProblemaDoItem[] } {
    const conferidos: ItemConferido[] = []
    const problemas: ProblemaDoItem[] = []

    itens.forEach((item, indice) => {
        const nomeDoItem = (item.name || 'Item').trim()
        const quantidade = Number(item.quantity)
        if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999) {
            problemas.push({ indice, tipo: 'quantidade_invalida', detalhe: `${nomeDoItem}: quantidade ${item.quantity}` })
            return
        }
        const produto = item.product_id ? catalogo.porId.get(item.product_id) : undefined
        if (!produto) {
            problemas.push({ indice, tipo: 'item_desconhecido', detalhe: `${nomeDoItem}: produto não encontrado no cadastro` })
            return
        }

        // 1. Preço base: sabor mais caro nas frações; meia porção do Marujo; senão o preço do produto
        let base = produto.price
        const sabores: string[] = []
        const fracoes = listaDeObjetos(item.fractions)
        if (produto.accepts_fractions && fracoes.length > 1) {
            let maior = 0
            let faltou = false
            for (const fracao of fracoes) {
                const sabor = acharSabor(produto, fracao, catalogo)
                if (!sabor) {
                    faltou = true
                    problemas.push({ indice, tipo: 'sabor_desconhecido', detalhe: `${nomeDoItem}: sabor "${fracao.name ?? '?'}" não encontrado` })
                    continue
                }
                sabores.push(sabor.name)
                maior = Math.max(maior, sabor.price)
            }
            if (faltou) return
            base = maior
        } else if (item.meia_porcao === true) {
            base = produto.price * FATOR_MEIA_PORCAO
        }

        // 2. Complementos com o preço cadastrado e a regra do "N grátis" por grupo
        const complementos: ComplementoConferido[] = []
        const escolhasPorGrupo = new Map<string, { grupo: GrupoCatalogo; escolhas: { preco: number; quantidade: number }[] }>()
        let faltouComplemento = false
        for (const enviado of listaDeObjetos(item.complements)) {
            const qtd = enviado.quantity === undefined || enviado.quantity === null ? 1 : Number(enviado.quantity)
            if (!Number.isFinite(qtd) || qtd <= 0 || qtd > 99) {
                problemas.push({ indice, tipo: 'quantidade_invalida', detalhe: `${nomeDoItem}: complemento com quantidade ${enviado.quantity}` })
                faltouComplemento = true
                continue
            }
            const achado = acharOpcao(produto, enviado)
            if (!achado) {
                problemas.push({
                    indice,
                    tipo: 'complemento_desconhecido',
                    detalhe: `${nomeDoItem}: complemento "${enviado.name ?? enviado.optionName ?? '?'}" não encontrado nos grupos do produto`,
                })
                faltouComplemento = true
                continue
            }
            const registro = escolhasPorGrupo.get(achado.grupo.id) || { grupo: achado.grupo, escolhas: [] }
            registro.escolhas.push({ preco: achado.opcao.price, quantidade: qtd })
            escolhasPorGrupo.set(achado.grupo.id, registro)
            complementos.push({
                group_id: achado.grupo.id,
                option_id: achado.opcao.id,
                name: achado.opcao.name,
                price: achado.opcao.price,
                quantity: qtd,
            })
        }
        if (faltouComplemento) return

        let valorComplementos = 0
        for (const { grupo, escolhas } of escolhasPorGrupo.values()) {
            valorComplementos += valorCobradoDoGrupo(escolhas, grupo.free_quantity)
        }

        conferidos.push({
            indice,
            produto,
            quantidade,
            unitarioNavegador: Number(item.unit_price) || 0,
            unitarioNuvem: arredondar2(base + valorComplementos),
            complementos,
            sabores,
        })
    })

    return { itens: conferidos, problemas }
}

export interface ConferenciaDoPedido {
    subtotal: number
    taxa: number
    total: number
    divergencias: string[]
}

/** Compara a conta da nuvem com a do navegador (item a item, taxa e total). */
export function compararComNavegador(
    itens: ItemConferido[],
    taxaNuvem: number,
    navegador: { delivery_fee: number; total_amount: number },
    entrega: boolean,
): ConferenciaDoPedido {
    const divergencias: string[] = []
    let subtotal = 0
    for (const item of itens) {
        subtotal += item.unitarioNuvem * item.quantidade
        if (difere(item.unitarioNavegador, item.unitarioNuvem)) {
            divergencias.push(
                `${item.produto.name}: navegador R$ ${item.unitarioNavegador.toFixed(2)}, cadastro R$ ${item.unitarioNuvem.toFixed(2)}`,
            )
        }
    }
    subtotal = arredondar2(subtotal)
    const taxa = entrega ? arredondar2(taxaNuvem) : 0
    if (entrega && difere(Number(navegador.delivery_fee) || 0, taxa)) {
        divergencias.push(`taxa de entrega: navegador R$ ${(Number(navegador.delivery_fee) || 0).toFixed(2)}, cadastro R$ ${taxa.toFixed(2)}`)
    }
    const total = arredondar2(subtotal + taxa)
    if (difere(Number(navegador.total_amount) || 0, total)) {
        divergencias.push(`total: navegador R$ ${(Number(navegador.total_amount) || 0).toFixed(2)}, cadastro R$ ${total.toFixed(2)}`)
    }
    return { subtotal, taxa, total, divergencias }
}

/** Nome que o cadastro ganhou sozinho (PDV ou cardápio antigo): pode ser trocado pelo nome que o cliente digitou. */
export function nomeProvisorio(nome?: string | null): boolean {
    const n = normalizar(nome)
    return !n || n === 'cliente delivery' || n === 'cliente' || n === 'consumidor' || /^[\d\s()+.-]+$/.test(n)
}
