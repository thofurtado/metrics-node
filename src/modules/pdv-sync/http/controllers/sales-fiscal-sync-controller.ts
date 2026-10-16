import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { gravarNotaFiscal, notaFiscalSchema } from '../../services/dados-da-venda'

/**
 * A NFC-e de uma venda que já subiu e mudou depois (Vendas, etapa 1, 16/10/2026): emitida pelo F9 "Emitir a nota", contingência
 * autorizada, cancelada na SEFAZ (também quando o cancelamento sai depois, pelo serviço do PDV). Só grava as colunas da nota:
 * não mexe em dinheiro, caixa, itens nem estoque, então vale para venda de caixa conferido.
 * Idempotente: o mesmo envio duas vezes dá o mesmo resultado; a mudança mais velha nunca passa por cima da mais nova (hora da
 * mudança no PDV, AlteradaEm). Resposta: `accepted` = gravadas ou a nuvem já tinha uma mais nova (o PDV dá por entregue);
 * `naoEncontradas` = a nuvem não tem a venda (o PDV também dá por entregue: quando a venda subir, ela leva a nota junto).
 */
export async function postSalesFiscalSync(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.array(z.object({
        Uuid: z.string().uuid(),
        NotaFiscal: notaFiscalSchema,
    })).max(200)
    const notas = schema.parse(request.body)

    const accepted: string[] = []
    const naoEncontradas: string[] = []
    for (const venda of notas) {
        const resultado = await gravarNotaFiscal(prisma, venda.Uuid, venda.NotaFiscal)
        if (resultado === 'VENDA_NAO_ENCONTRADA') naoEncontradas.push(venda.Uuid)
        else accepted.push(venda.Uuid)
    }

    if (naoEncontradas.length > 0) {
        request.log.warn({ naoEncontradas }, '[pdv-sync] nota fiscal de venda que a nuvem não tem')
    }
    return reply.status(200).send({ message: 'Notas fiscais das vendas atualizadas', accepted, naoEncontradas, notaFiscal: true })
}
