/**
 * Valores dos pedidos do iFood e da 99Food (decisão do Thomás, 15/10/2026): tabela pedido_valores_plataforma.
 *
 * Por quê: a plataforma manda o pedido com os valores detalhados, mas a nuvem só guardava o total (o que o cliente pagou). O
 * iFood paga à loja itens + frete − desconto da LOJA antes da comissão; o incentivo que o iFood dá ao cliente volta para a loja
 * no repasse, e a taxa de serviço cobrada do cliente fica com o iFood. Pedido real da Katatau (iFood, 14/10/2026 16:17):
 * itens 55,90 + frete 9,99 + taxa de serviço 1,40 − desconto 13,97 (iFood 8,97 + loja 5,00) = cliente pagou 53,32; a loja tem a
 * receber 55,90 + 9,99 − 5,00 = 60,89 antes da comissão. A venda continua com 53,32 (nada aqui muda a venda nem o caixa): só a
 * conferência do caixa usa os valores para o repasse previsto, e o PDV recebe o objeto "platform_values" junto com o pedido.
 *
 * As funções de transformação são puras (testadas em valores-da-plataforma.spec.ts com os pedidos reais do diário). As de banco
 * nunca derrubam o pedido: a tabela pode ainda não existir numa loja (antes do Sincronizar do SaaS Admin).
 */

export type CodigoDaPlataforma = 'IFOOD' | '99FOOD'

/** Os campos de uma linha da tabela (menos os *_real, que virão do extrato). Valor nulo = a plataforma não informou. */
export interface ValoresDaPlataforma {
    platform: CodigoDaPlataforma
    external_id: string
    items_value: number | null
    delivery_fee: number | null
    service_fee: number | null
    discount_total: number | null
    discount_store: number | null
    discount_platform: number | null
    discount_other: number | null
    customer_paid: number | null
    paid_online: boolean
    /** null = não se sabe (ou retirada, sem entrega) */
    own_delivery: boolean | null
    /** O que a plataforma deve à loja antes da comissão e da taxa (itens + frete da entrega da loja − desconto da loja) */
    expected_gross: number | null
    /** O trecho dos valores exatamente como veio da plataforma */
    raw: Record<string, unknown>
}

/** O objeto "platform_values" que vai para o PDV junto com o pedido (contrato fixo com o PDV, 15/10/2026: os nomes não mudam). */
export type ValoresParaOPdv = ValoresDaPlataforma

const centavos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

/** Número ou null (vazio, texto que não é número, infinito). */
function numero(v: unknown): number | null {
    if (v == null || v === '' || typeof v === 'boolean') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const texto = (v: unknown): string => (v == null ? '' : String(v).trim())

const soma = (valores: (number | null)[]) => valores.reduce<number>((s, v) => s + (v ?? 0), 0)

/** Sem as chaves vazias (o JSON guardado fica só com o que a plataforma mandou). */
function semVazios(objeto: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined))
}

/**
 * O que a plataforma deve à loja antes da comissão e da taxa: itens + frete (só quando a entrega é da loja ou não se sabe) −
 * desconto que a LOJA bancou. Inclui o incentivo da plataforma (ela paga à loja o que deu de desconto ao cliente) e não inclui a
 * taxa de serviço (é da plataforma). Sem os itens ou sem saber o desconto da loja = null (a conferência faz como antes).
 */
export function repasseBrutoPrevisto(v: Pick<ValoresDaPlataforma, 'items_value' | 'delivery_fee' | 'discount_store' | 'own_delivery'>): number | null {
    if (v.items_value == null || v.discount_store == null) return null
    const frete = v.own_delivery === false ? 0 : (v.delivery_fee ?? 0)
    return centavos(v.items_value + frete - v.discount_store)
}

// ---------------------------------------------------------------------------------------------------------------
// iFood: GET /order/v1.0/orders/{id}
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pedido completo do iFood → campos da tabela. Conferido nos pedidos reais da Katatau no diário (ifood_api_logs, 12 a 14/10):
 * - itens = total.subTotal; frete = total.deliveryFee; taxa de serviço = total.additionalFees (a soma de additionalFees[], que o
 *   iFood diz ser 100% dele em liabilities); desconto = total.benefits; cliente pagou = total.orderAmount;
 * - de quem é o desconto: benefits[].sponsorshipValues[] por "name": MERCHANT = loja, IFOOD = iFood, o resto (EXTERNAL =
 *   indústria, CHAIN = rede) = outros. O alvo (ITEM, CART, DELIVERY_FEE) não importa: frete grátis pago pelo iFood também volta
 *   para a loja. Desconto sem a divisão de quem pagou (nunca visto) conta como da loja, como antes (a venda já sai sem ele);
 * - pago no app: payments.methods[] todos ONLINE; quem entrega: delivery.deliveredBy (MERCHANT = loja, IFOOD = iFood);
 *   retirada (sem entrega) = null.
 */
export function valoresDoPedidoIfood(order: any): ValoresDaPlataforma | null {
    if (!order || typeof order !== 'object') return null
    const id = texto(order.id)
    if (!id) return null

    const total = order.total && typeof order.total === 'object' ? order.total : {}
    const beneficios: any[] = Array.isArray(order.benefits) ? order.benefits : []
    const taxas: any[] = Array.isArray(order.additionalFees) ? order.additionalFees : []
    const pagamentos = order.payments && typeof order.payments === 'object' ? order.payments : null
    const metodos: any[] = Array.isArray(pagamentos?.methods) ? pagamentos.methods : []

    const itens = numero(total.subTotal)
    const frete = numero(total.deliveryFee)
    const servico = numero(total.additionalFees) ?? centavos(soma(taxas.map(t => numero(t?.value))))
    const descontoTotal = numero(total.benefits) ?? centavos(soma(beneficios.map(b => numero(b?.value))))

    let loja = 0
    let plataforma = 0
    let outros = 0
    for (const beneficio of beneficios) {
        const patrocinios: any[] = Array.isArray(beneficio?.sponsorshipValues) ? beneficio.sponsorshipValues : []
        for (const p of patrocinios) {
            const valor = numero(p?.value) ?? 0
            const quem = texto(p?.name).toUpperCase()
            if (quem === 'MERCHANT') loja += valor
            else if (quem === 'IFOOD') plataforma += valor
            else outros += valor
        }
    }
    const semDono = descontoTotal - (loja + plataforma + outros)
    if (semDono > 0.005) loja += semDono

    const tipo = texto(order.orderType).toUpperCase()
    const entreguePor = texto(order.delivery?.deliveredBy).toUpperCase()
    const ownDelivery = tipo && tipo !== 'DELIVERY'
        ? null // retirada (TAKEOUT) ou no salão (INDOOR): não tem entrega
        : entreguePor === 'MERCHANT' ? true : entreguePor === 'IFOOD' ? false : null

    const pagoOnline = metodos.length > 0
        ? metodos.every(m => texto(m?.type).toUpperCase() === 'ONLINE')
        : numero(pagamentos?.pending) === 0 && (numero(pagamentos?.prepaid) ?? 0) > 0

    const valores: ValoresDaPlataforma = {
        platform: 'IFOOD',
        external_id: id,
        items_value: itens,
        delivery_fee: frete,
        service_fee: servico,
        discount_total: descontoTotal,
        discount_store: centavos(loja),
        discount_platform: centavos(plataforma),
        discount_other: centavos(outros),
        customer_paid: numero(total.orderAmount),
        paid_online: pagoOnline,
        own_delivery: ownDelivery,
        expected_gross: null,
        raw: semVazios({
            total: order.total,
            benefits: order.benefits,
            additionalFees: order.additionalFees,
            payments: order.payments,
            orderType: order.orderType,
            deliveredBy: order.delivery?.deliveredBy,
        }),
    }
    valores.expected_gross = repasseBrutoPrevisto(valores)
    return valores
}

// ---------------------------------------------------------------------------------------------------------------
// 99Food: webhook orderNew (data.order_info), valores em centavos
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pedido da 99Food → campos da tabela. Conferido nos 27 pedidos reais da Katatau no diário (EVENT99 orderNew, 13 a 15/10):
 * - itens = price.order_price (antes dos descontos); frete = price.delivery_price (o que o cliente pagou de frete) +
 *   price.delivery_discount (o desconto no frete), que bate com store_charged_delivery_price em todos os pedidos de entrega da
 *   loja; taxa de serviço = others_fees.service_price + small_order_price + meal_top_up_price (o que o cliente paga além de
 *   itens e frete; a gorjeta total_tip_money fica de fora e só aparece em customer_paid);
 * - desconto total = items_discount + delivery_discount; da loja = soma de promotions[].shop_subside_price (o que a loja
 *   bancou de cada promoção; bate com others_fees.coupon_discount em todos os pedidos, que vale quando não vier a lista); da 99
 *   = o resto; outros = 0 (a 99 não manda indústria/rede);
 * - cliente pagou = price.real_pay_price; pago no app = pay_method 1; entrega da loja = delivery_type 2, da 99 = 1, retirada
 *   (fulfillment_mode 1 ou delivery_type 0) = null.
 * Conta que fecha nos pedidos reais: real_price = itens − desconto da loja + frete + taxa de serviço; real_pay_price = real_price
 * − desconto da 99. O pedido grava real_price como total (valor_final), por isso a venda da 99 já inclui o incentivo da 99.
 */
export function valoresDoPedido99(orderInfo: any, orderId?: string | null): ValoresDaPlataforma | null {
    const price = orderInfo?.price
    if (!price || typeof price !== 'object') return null
    const id = texto(orderId ?? orderInfo?.order_id)
    if (!id) return null

    const reais = (v: unknown): number | null => {
        const n = numero(v)
        return n == null ? null : centavos(n / 100)
    }
    const outras = price.others_fees && typeof price.others_fees === 'object' ? price.others_fees : {}
    const promocoes: any[] | null = Array.isArray(orderInfo?.promotions) ? orderInfo.promotions : null

    const itens = reais(price.order_price)
    const fretePago = reais(price.delivery_price)
    const descontoFrete = reais(price.delivery_discount)
    const frete = fretePago == null && descontoFrete == null ? null : centavos((fretePago ?? 0) + (descontoFrete ?? 0))
    const partesDaTaxa = [outras.service_price, outras.small_order_price, outras.meal_top_up_price].map(reais)
    const servico = partesDaTaxa.some(v => v != null) ? centavos(soma(partesDaTaxa)) : null

    const descontoItens = reais(price.items_discount)
    const descontoTotal = descontoItens != null || descontoFrete != null
        ? centavos((descontoItens ?? 0) + (descontoFrete ?? 0))
        : promocoes ? centavos(soma(promocoes.map(p => numero(p?.promo_discount))) / 100) : null
    const loja = promocoes
        ? centavos(soma(promocoes.map(p => numero(p?.shop_subside_price))) / 100)
        : reais(outras.coupon_discount) ?? (descontoTotal === 0 ? 0 : null)
    const plataforma = descontoTotal != null && loja != null ? centavos(Math.max(0, descontoTotal - loja)) : null

    const tipoDeEntrega = numero(orderInfo?.delivery_type)
    const retirada = numero(orderInfo?.fulfillment_mode) === 1 || tipoDeEntrega === 0
    const ownDelivery = retirada ? null : tipoDeEntrega === 2 ? true : tipoDeEntrega === 1 ? false : null

    const valores: ValoresDaPlataforma = {
        platform: '99FOOD',
        external_id: id,
        items_value: itens,
        delivery_fee: frete,
        service_fee: servico,
        discount_total: descontoTotal,
        discount_store: loja,
        discount_platform: plataforma,
        discount_other: plataforma != null ? 0 : null,
        customer_paid: reais(price.real_pay_price) ?? reais(price.customer_need_paying_money),
        paid_online: numero(orderInfo?.pay_method) === 1,
        own_delivery: ownDelivery,
        expected_gross: null,
        raw: semVazios({
            price,
            promotions: orderInfo?.promotions,
            delivery_type: orderInfo?.delivery_type,
            fulfillment_mode: orderInfo?.fulfillment_mode,
            pay_method: orderInfo?.pay_method,
            pay_type: orderInfo?.pay_type,
        }),
    }
    valores.expected_gross = repasseBrutoPrevisto(valores)
    return valores
}

// ---------------------------------------------------------------------------------------------------------------
// Banco (nunca derruba o pedido nem a lista)
// ---------------------------------------------------------------------------------------------------------------

const jaAvisado = new Set<string>()
function avisarUmaVez(chave: string, mensagem: string) {
    if (jaAvisado.has(chave)) return
    jaAvisado.add(chave)
    if (jaAvisado.size > 500) jaAvisado.clear()
    console.warn(mensagem)
}

/** Linha da tabela como o Prisma devolve (só o que as telas e a conferência usam). */
export interface LinhaDosValores {
    pedido_id: number
    platform: string
    external_id: string
    items_value: number | null
    delivery_fee: number | null
    service_fee: number | null
    discount_total: number | null
    discount_store: number | null
    discount_platform: number | null
    discount_other: number | null
    customer_paid: number | null
    paid_online: boolean
    own_delivery: boolean | null
    expected_gross: number | null
    raw: unknown
}

/** Linha da tabela → o objeto "platform_values" do PDV (as 14 chaves do contrato, nem mais nem menos). */
export function valoresParaOPdv(linha: LinhaDosValores): ValoresParaOPdv {
    return {
        platform: linha.platform as CodigoDaPlataforma,
        external_id: linha.external_id,
        items_value: linha.items_value,
        delivery_fee: linha.delivery_fee,
        service_fee: linha.service_fee,
        discount_total: linha.discount_total,
        discount_store: linha.discount_store,
        discount_platform: linha.discount_platform,
        discount_other: linha.discount_other,
        customer_paid: linha.customer_paid,
        paid_online: linha.paid_online,
        own_delivery: linha.own_delivery,
        expected_gross: linha.expected_gross,
        raw: (linha.raw && typeof linha.raw === 'object' ? linha.raw : {}) as Record<string, unknown>,
    }
}

/**
 * Grava (ou regrava) a linha do pedido. Nunca lança: o pedido já foi gravado e vale mais que os valores (sem a linha, a
 * conferência faz como antes). Os *_real não são tocados.
 */
export async function gravarValoresDaPlataforma(prisma: any, pedidoId: number, valores: ValoresDaPlataforma | null): Promise<boolean> {
    if (!valores || !Number.isInteger(pedidoId)) return false
    try {
        const dados = {
            platform: valores.platform,
            external_id: valores.external_id,
            items_value: valores.items_value,
            delivery_fee: valores.delivery_fee,
            service_fee: valores.service_fee,
            discount_total: valores.discount_total,
            discount_store: valores.discount_store,
            discount_platform: valores.discount_platform,
            discount_other: valores.discount_other,
            customer_paid: valores.customer_paid,
            paid_online: valores.paid_online,
            own_delivery: valores.own_delivery,
            expected_gross: valores.expected_gross,
            raw: valores.raw as any,
        }
        await prisma.pedidoValoresPlataforma.upsert({
            where: { pedido_id: pedidoId },
            create: { pedido_id: pedidoId, ...dados },
            update: dados,
        })
        return true
    } catch (erro: any) {
        console.error(`[Valores da plataforma] Não gravou os valores do pedido ${valores.platform} ${valores.external_id} (#${pedidoId}):`, erro?.message || erro)
        return false
    }
}

/** Valores dos pedidos (pedido_id → linha), para mandar ao PDV. Tabela que ainda não existe = nenhum valor. */
export async function lerValoresDosPedidos(prisma: any, pedidoIds: number[]): Promise<Map<number, LinhaDosValores>> {
    const ids = [...new Set(pedidoIds.filter(id => Number.isInteger(id)))]
    if (ids.length === 0 || typeof prisma?.pedidoValoresPlataforma?.findMany !== 'function') return new Map()
    try {
        const linhas: LinhaDosValores[] = await prisma.pedidoValoresPlataforma.findMany({ where: { pedido_id: { in: ids } } })
        return new Map(linhas.map(l => [l.pedido_id, l]))
    } catch (erro: any) {
        avisarUmaVez(`ler:${erro?.code ?? erro?.message}`, `[Valores da plataforma] Sem os valores dos pedidos (a tabela existe? rode o Sincronizar do SaaS Admin): ${erro?.message || erro}`)
        return new Map()
    }
}

/** O que a conferência do caixa usa de cada venda (o código da venda é o uuid do pedido). */
export interface ValoresDaVendaLidos extends LinhaDosValores {
    /** pedidos.valor_final: o total que o PDV recebeu do pedido */
    valor_do_pedido: number | null
}

/** Valores das vendas do caixa (sale_id = pedidos.uuid → linha). Tabela que ainda não existe = nenhum valor (como antes). */
export async function lerValoresDasVendas(prisma: any, saleIds: string[]): Promise<Map<string, ValoresDaVendaLidos>> {
    const ids = [...new Set(saleIds.filter(Boolean))]
    if (ids.length === 0 || typeof prisma?.pedidoValoresPlataforma?.findMany !== 'function') return new Map()
    try {
        const linhas: (LinhaDosValores & { pedido: { uuid: string; valor_final: number | null } })[] = await prisma.pedidoValoresPlataforma.findMany({
            where: { pedido: { uuid: { in: ids } } },
            include: { pedido: { select: { uuid: true, valor_final: true } } },
        })
        return new Map(linhas.map(({ pedido, ...l }) => [pedido.uuid, { ...l, valor_do_pedido: pedido.valor_final ?? null }]))
    } catch (erro: any) {
        avisarUmaVez(`vendas:${erro?.code ?? erro?.message}`, `[Valores da plataforma] Conferência sem os valores das plataformas (a tabela existe? rode o Sincronizar do SaaS Admin): ${erro?.message || erro}`)
        return new Map()
    }
}
