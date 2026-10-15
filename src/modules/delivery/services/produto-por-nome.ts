/**
 * Último recurso do vínculo do item do iFood e da 99 com o produto do Metrics: o nome igual, sem diferenciar maiúsculas.
 *
 * Fase 4 do Mergulho (09:F4, 15/10/2026): antes pegava o PRIMEIRO produto com esse nome. Com dois produtos de mesmo nome
 * (tamanhos, preços diferentes, um desativado), o item podia ir para o produto errado e a cozinha, o estoque e a nota saíam
 * errados. Agora só liga quando há UM produto com esse nome (os desativados só contam se não houver nenhum ativo); com dois ou
 * mais, o item entra sem vínculo e com o nome da plataforma, como qualquer item desconhecido (o pedido entra do mesmo jeito).
 * Conferido nas lojas em 15/10/2026: nenhum item do iFood ou da 99 tinha sido ligado por nome; a Katatau tem 1 nome repetido.
 */
export async function produtoUnicoPeloNome(prisma: any, nome: string): Promise<any | null> {
  const texto = String(nome ?? '').trim()
  if (!texto) return null
  const achados: any[] = await prisma.product.findMany({
    where: { name: { equals: texto, mode: 'insensitive' } },
    take: 5,
  })
  const ativos = achados.filter((p) => p?.active !== false)
  if (ativos.length === 1) return ativos[0]
  if (ativos.length === 0 && achados.length === 1) return achados[0]
  return null
}
