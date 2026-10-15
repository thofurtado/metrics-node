import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { acharClienteComTelefone } from '@/modules/clients/services/telefone-do-cliente'

// Fase 4 do Mergulho (16:A7): antes não havia como corrigir o cadastro de um cliente (nome errado, telefone novo) nem
// tirar um cadastro feito por engano: o repositório só tinha "Method not implemented" e não havia rota.
// O PDV recebe a correção na sincronia seguinte (ele baixa o cadastro da nuvem quando o dele já está sincronizado).

const paramsSchema = z.object({ id: z.string().uuid() })

export async function updateClient(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        name: z.string().trim().min(1, 'Informe o nome do cliente.').optional(),
        identification: z.string().nullish(),
        phone: z.string().nullish(),
        email: z.string().nullish(),
        contract: z.boolean().nullish(),
        contact: z.string().nullish(),
        isEnterprise: z.boolean().nullish(),
        allowDuplicatePhone: z.boolean().nullish(),
    })
    const { id } = paramsSchema.parse(request.params)
    const body = bodySchema.parse(request.body)

    const atual = await prisma.client.findUnique({ where: { id }, select: { id: true, phone: true } })
    if (!atual) {
        return reply.status(404).send({ message: 'Cliente não encontrado.' })
    }

    // 16:A8: só confere quando o telefone muda (cadastros repetidos antigos não travam a edição de outros campos)
    const vazioVira = (v: string | null | undefined) => (v === undefined ? undefined : (v && v.trim()) || null)
    const novoTelefone = vazioVira(body.phone)
    if (novoTelefone && novoTelefone !== atual.phone && !body.allowDuplicatePhone) {
        const outro = await acharClienteComTelefone(prisma as any, novoTelefone, id)
        if (outro) {
            return reply.status(409).send({
                code: 'DUPLICATE_PHONE',
                message: `Já existe o cliente "${outro.name}" com este telefone.`,
                client: outro,
            })
        }
    }

    try {
        const client = await prisma.client.update({
            where: { id },
            data: {
                name: body.name,
                identification: vazioVira(body.identification),
                phone: novoTelefone,
                email: vazioVira(body.email),
                contact: vazioVira(body.contact),
                contract: body.contract ?? undefined,
                isEnterprise: body.isEnterprise ?? undefined,
            },
        })
        return reply.status(200).send({ client })
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return reply.status(409).send({ message: 'Este CPF/CNPJ já está no cadastro de outro cliente.' })
        }
        throw err
    }
}

/**
 * Tira um cadastro de cliente feito por engano. Só quando ele não tem NADA ligado (O.S., equipamento, conta a prazo,
 * lançamento de caixa, pedido): com movimento, o cadastro é a prova do histórico e não pode sumir.
 */
export async function deleteClient(request: FastifyRequest, reply: FastifyReply) {
    const { id } = paramsSchema.parse(request.params)

    const cliente = await prisma.client.findUnique({ where: { id }, select: { id: true } })
    if (!cliente) {
        return reply.status(404).send({ message: 'Cliente não encontrado.' })
    }

    const [atendimentos, equipamentos, contas, caixa, pedidos] = await Promise.all([
        prisma.treatment.count({ where: { client_id: id } }),
        prisma.equipment.count({ where: { client_id: id } }),
        prisma.clientTab.count({ where: { client_id: id } }),
        prisma.cashierEntry.count({ where: { client_id: id } }),
        prisma.pedido.count({ where: { cliente_id: id } }),
    ])
    const ligados = [
        atendimentos && `${atendimentos} atendimento(s)`,
        equipamentos && `${equipamentos} equipamento(s)`,
        contas && `${contas} conta(s) a prazo`,
        caixa && `${caixa} lançamento(s) de caixa`,
        pedidos && `${pedidos} pedido(s)`,
    ].filter(Boolean)
    if (ligados.length > 0) {
        return reply.status(409).send({
            code: 'CLIENT_HAS_HISTORY',
            message: `Este cliente tem ${ligados.join(', ')} e não pode ser excluído. Corrija o cadastro em vez de excluir.`,
        })
    }

    await prisma.$transaction([
        prisma.address.deleteMany({ where: { client_id: id } }),
        prisma.client.delete({ where: { id } }),
    ])
    return reply.status(204).send()
}
