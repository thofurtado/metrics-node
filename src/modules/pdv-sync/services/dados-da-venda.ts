import { Prisma } from '@prisma/client'
import { z } from 'zod'

/**
 * Dados da venda para o "venda por venda, produto por produto" (Vendas, etapa 1; decisões D3, D4, D11 e D12 do Thomás, 16/10/2026;
 * _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md). O PDV novo (ramo vendas-dados) manda, em cada venda:
 *  - por item: o nome como foi vendido, o vendedor (código, nome e número), os complementos escolhidos e a observação livre;
 *  - na venda: a NFC-e (situação, número, série, ambiente, chave, se saiu em contingência e o motivo da recusa).
 * Tudo opcional: o PDV antigo não manda e nada muda para ele; venda antiga fica com "—" na web.
 * A nota que muda depois (emitida pelo F9, contingência autorizada, cancelada) chega pela venda reenviada OU pela rota própria
 * POST /api/pdv/sync/sales/fiscal. As duas usam a mesma regra: a mudança mais velha nunca passa por cima da mais nova.
 * Nada aqui mexe em dinheiro, caixa ou estoque: por isso vale também para venda de caixa conferido.
 */

/** As situações da nota que o PDV manda (o PDV decide em NotaFiscalDaVenda.Situacao). */
export const SITUACOES_DA_NOTA = [
    'SEM_NOTA',              // venda sem NFC-e (não fiscal, ou a nota não foi tentada)
    'RECUSADA',              // a nota não saiu (a SEFAZ recusou ou erro antes de enviar): dá para emitir depois pelo F9
    'CONTINGENCIA',          // emitida sem internet, esperando o envio à SEFAZ
    'AUTORIZADA',            // autorizada (direto ou depois da contingência: nfce_contingency diz)
    'CONTINGENCIA_RECUSADA', // a SEFAZ recusou a nota de contingência ao subir (dá para emitir de novo pelo F9)
    'CANCELAMENTO_PENDENTE', // venda cancelada: a nota de contingência será enviada e cancelada quando a internet voltar
    'CANCELADA',             // cancelada na SEFAZ
    'CANCELAMENTO_FALHOU',   // venda cancelada no PDV, mas a nota continua valendo na SEFAZ
] as const

export const notaFiscalSchema = z.object({
    Situacao: z.string(),
    Numero: z.number().int().optional().nullable(),
    Serie: z.number().int().optional().nullable(),
    Ambiente: z.string().optional().nullable(),
    Chave: z.string().optional().nullable(),
    Contingencia: z.boolean().optional().nullable(),
    Motivo: z.string().optional().nullable(),
    // Quando a nota mudou no PDV (ISO, UTC). Sem ela (venda que nunca mudou), vale só se a nuvem também não tem hora.
    AlteradaEm: z.string().optional().nullable(),
})
export type NotaFiscalDoPdv = z.infer<typeof notaFiscalSchema>

/** Campos novos do item (todos opcionais), somados ao esquema do item da venda. */
export const camposNovosDoItemSchema = {
    NomeVendido: z.string().optional().nullable(),
    // Código do vendedor no PDV: o funcionário do RH ou o usuário do sistema (a nuvem acha o funcionário pelos dois)
    VendedorId: z.string().optional().nullable(),
    VendedorNome: z.string().optional().nullable(),
    VendedorNumero: z.number().int().optional().nullable(),
    ComplementosEscolhidos: z.array(z.object({
        Grupo: z.string().optional().nullable(),
        Nome: z.string(),
        Quantidade: z.number().optional().nullable(),
        Preco: z.number().optional().nullable(),
        ObservacaoRapida: z.boolean().optional().nullable(),
    })).optional().nullable(),
    ObservacaoLivre: z.string().optional().nullable(),
}
const camposNovosDoItem = z.object(camposNovosDoItemSchema)
export type CamposNovosDoItem = z.infer<typeof camposNovosDoItem>

const texto = (t: string | null | undefined, max: number): string | null => {
    const limpo = (t ?? '').trim()
    return limpo === '' ? null : limpo.slice(0, max)
}

/** A hora da mudança que o PDV mandou (null = sem hora ou hora inválida). */
export function horaDaNota(nota: NotaFiscalDoPdv): Date | null {
    if (!nota.AlteradaEm) return null
    const d = new Date(nota.AlteradaEm)
    return Number.isNaN(d.getTime()) ? null : d
}

/** As colunas da venda para a nota que o PDV mandou. */
export function camposDaNota(nota: NotaFiscalDoPdv) {
    return {
        nfce_status: texto(nota.Situacao, 40)?.toUpperCase() ?? 'SEM_NOTA',
        nfce_number: nota.Numero && nota.Numero > 0 ? nota.Numero : null,
        nfce_series: nota.Serie && nota.Serie > 0 ? nota.Serie : null,
        nfce_environment: texto(nota.Ambiente, 1)?.toUpperCase() ?? null,
        nfce_key: texto(nota.Chave, 60),
        nfce_contingency: nota.Contingencia ?? null,
        nfce_reason: texto(nota.Motivo, 500),
        nfce_changed_at: horaDaNota(nota),
    }
}

/**
 * Onde a nota pode ser gravada: a mudança mais nova (ou igual) vale; a mais velha nunca passa por cima (o envio da venda e a
 * rota da nota podem chegar fora de ordem). Sem hora no envio: só grava se a nuvem também não tem hora.
 */
export function ondeGravarANota(vendaId: string, hora: Date | null): Prisma.SaleWhereInput {
    return hora
        ? { id: vendaId, OR: [{ nfce_changed_at: null }, { nfce_changed_at: { lte: hora } }] }
        : { id: vendaId, nfce_changed_at: null }
}

type ClienteDaNota = { sale: { updateMany: (args: any) => Promise<{ count: number }>; findUnique: (args: any) => Promise<unknown> } }

export type ResultadoDaNota = 'GRAVADA' | 'NUVEM_MAIS_NOVA' | 'VENDA_NAO_ENCONTRADA'

/** Grava a nota numa venda que já existe, pela regra da hora. Idempotente: o mesmo envio duas vezes dá o mesmo resultado. */
export async function gravarNotaFiscal(db: ClienteDaNota, vendaId: string, nota: NotaFiscalDoPdv): Promise<ResultadoDaNota> {
    const r = await db.sale.updateMany({ where: ondeGravarANota(vendaId, horaDaNota(nota)), data: camposDaNota(nota) })
    if (r.count > 0) return 'GRAVADA'
    const existe = await db.sale.findUnique({ where: { id: vendaId }, select: { id: true } })
    return existe ? 'NUVEM_MAIS_NOVA' : 'VENDA_NAO_ENCONTRADA'
}

/** As escolhas do item como a nuvem guarda (null = nenhuma). */
export function complementosParaGuardar(item: CamposNovosDoItem): Prisma.InputJsonValue | null {
    const lista = (item.ComplementosEscolhidos ?? [])
        .map(c => ({
            grupo: texto(c.Grupo, 120),
            nome: texto(c.Nome, 200),
            quantidade: c.Quantidade && c.Quantidade > 0 ? c.Quantidade : 1,
            preco: c.Preco ?? 0,
            observacaoRapida: c.ObservacaoRapida === true,
        }))
        .filter(c => c.nome !== null)
    return lista.length === 0 ? null : lista
}

/** Colunas novas do item (só as que vieram), com o funcionário do RH já achado. */
export function camposDoItem(item: CamposNovosDoItem, funcionarioId: string | null) {
    const campos: {
        sold_name?: string
        seller_employee_id?: string
        seller_name?: string
        seller_number?: number
        complements?: Prisma.InputJsonValue
        note?: string
    } = {}
    const nome = texto(item.NomeVendido, 200)
    if (nome) campos.sold_name = nome
    if (funcionarioId) campos.seller_employee_id = funcionarioId
    const vendedor = texto(item.VendedorNome, 120)
    if (vendedor) campos.seller_name = vendedor
    if (item.VendedorNumero && item.VendedorNumero > 0) campos.seller_number = item.VendedorNumero
    const complementos = complementosParaGuardar(item)
    if (complementos) campos.complements = complementos
    const obs = texto(item.ObservacaoLivre, 500)
    if (obs) campos.note = obs
    return campos
}

export type ItemGuardado = {
    sold_name: string | null
    seller_employee_id: string | null
    seller_name: string | null
    seller_number: number | null
    complements: unknown
    note: string | null
}

/**
 * O que falta num item que já está na nuvem (venda que subiu pelo PDV antigo e foi reenviada pelo novo): só completa o vazio,
 * nunca troca o que já está gravado (o item vendido não muda depois da venda).
 */
export function camposQueFaltam(guardado: ItemGuardado, novos: ReturnType<typeof camposDoItem>) {
    const faltam: ReturnType<typeof camposDoItem> = {}
    if (novos.sold_name && guardado.sold_name == null) faltam.sold_name = novos.sold_name
    if (novos.seller_employee_id && guardado.seller_employee_id == null) faltam.seller_employee_id = novos.seller_employee_id
    if (novos.seller_name && guardado.seller_name == null) faltam.seller_name = novos.seller_name
    if (novos.seller_number && guardado.seller_number == null) faltam.seller_number = novos.seller_number
    if (novos.complements && guardado.complements == null) faltam.complements = novos.complements
    if (novos.note && guardado.note == null) faltam.note = novos.note
    return faltam
}

/** O item manda o vendedor? (para só procurar o funcionário quando precisa) */
export function temVendedor(item: CamposNovosDoItem): boolean {
    return !!texto(item.VendedorId, 64)
}

type ClienteDoFuncionario = { employee: { findFirst: (args: any) => Promise<{ id: string } | null> } }

/**
 * O funcionário do RH do vendedor: o PDV manda o código do funcionário (quem entra pelo PIN do grupo) ou o do usuário do
 * sistema (que pode estar ligado a um funcionário). Não achou = null (fica o nome e o número). Uma consulta por vendedor no envio.
 */
export async function funcionarioDoVendedor(db: ClienteDoFuncionario, vendedorId: string | null | undefined, achados: Map<string, string | null>): Promise<string | null> {
    const id = texto(vendedorId, 64)
    if (!id) return null
    if (achados.has(id)) return achados.get(id)!
    const f = await db.employee.findFirst({ where: { OR: [{ id }, { user_id: id }] }, select: { id: true } })
    achados.set(id, f?.id ?? null)
    return f?.id ?? null
}

/**
 * O número do pedido no PDV, a senha do dia e o cliente da venda (Vendas, etapa 3, 16/10/2026). O PDV já mandava DisplayId,
 * NumeroDiario e ClienteUuid; a nuvem não guardava, e a lista "venda a venda" precisa do número e da senha. Só vai o que veio
 * (PDV antigo sem o campo não apaga nada). O cliente só se já existe na nuvem (os clientes sobem antes das vendas no ciclo).
 */
export type NumeracaoDaVenda = { display_id?: number; daily_number?: number; client_id?: string }

type ClienteDaNumeracao = { client: { findUnique: (args: any) => Promise<{ id: string } | null> } }

export async function numeracaoDaVenda(
    db: ClienteDaNumeracao,
    venda: { DisplayId?: number | null; NumeroDiario?: number | null; ClienteUuid?: string | null },
): Promise<NumeracaoDaVenda> {
    const campos: NumeracaoDaVenda = {}
    if (venda.DisplayId && venda.DisplayId > 0) campos.display_id = venda.DisplayId
    if (venda.NumeroDiario && venda.NumeroDiario > 0) campos.daily_number = venda.NumeroDiario
    if (venda.ClienteUuid) {
        const cliente = await db.client.findUnique({ where: { id: venda.ClienteUuid }, select: { id: true } })
        if (cliente) campos.client_id = cliente.id
    }
    return campos
}

/** O que falta na venda que já está na nuvem: só completa o vazio (o número e a senha da venda não mudam depois). */
export function numeracaoQueFalta(
    guardada: { display_id?: number | null; daily_number?: number | null; client_id?: string | null },
    nova: NumeracaoDaVenda,
): NumeracaoDaVenda {
    const faltam: NumeracaoDaVenda = {}
    if (nova.display_id && guardada.display_id == null) faltam.display_id = nova.display_id
    if (nova.daily_number && guardada.daily_number == null) faltam.daily_number = nova.daily_number
    if (nova.client_id && guardada.client_id == null) faltam.client_id = nova.client_id
    return faltam
}
