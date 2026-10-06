import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../../../../lib/prisma"
import { chaveDoGrupo, normalizarNomeDoGrupo } from "../../../pdv-sync/services/equipe-do-pdv"

/**
 * Grupos de funcionários (etapa 1.5, 06/10/2026, decisão B5): o cargo virou cadastro. Cada grupo diz se quem está nele
 * pode usar o app do garçom e/ou o PDV (login pelo PIN do ponto). Os grupos nasceram dos cargos que já existiam.
 */

const grupoBodySchema = z.object({
    name: z.string().transform(normalizarNomeDoGrupo).pipe(z.string().min(2, "Nome do grupo muito curto").max(60)),
    can_use_waiter_app: z.boolean().default(false),
    can_use_pdv: z.boolean().default(false),
})

const idParamsSchema = z.object({ id: z.string().min(1) })

/** O grupo com o mesmo nome sem olhar acento nem maiúscula ("Maitrê" = "maitre"); são poucos grupos por loja. */
async function acharGrupoPeloNome(nome: string, ignorarId?: string) {
    const chave = chaveDoGrupo(nome)
    const grupos = await prisma.employeeGroup.findMany()
    return grupos.find((g) => g.id !== ignorarId && chaveDoGrupo(g.name) === chave) ?? null
}

async function nomeJaUsado(nome: string, ignorarId?: string) {
    return !!(await acharGrupoPeloNome(nome, ignorarId))
}

export async function listEmployeeGroups(_request: FastifyRequest, reply: FastifyReply) {
    const grupos = await prisma.employeeGroup.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { employees: true } } },
    })
    return reply.status(200).send(grupos.map(({ _count, ...g }) => ({ ...g, employeesCount: _count.employees })))
}

export async function createEmployeeGroup(request: FastifyRequest, reply: FastifyReply) {
    const data = grupoBodySchema.parse(request.body)
    if (await nomeJaUsado(data.name)) return reply.status(409).send({ message: "GROUP_ALREADY_EXISTS" })
    const grupo = await prisma.employeeGroup.create({ data })
    return reply.status(201).send(grupo)
}

export async function updateEmployeeGroup(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamsSchema.parse(request.params)
    const data = grupoBodySchema.parse(request.body)
    if (await nomeJaUsado(data.name, id)) return reply.status(409).send({ message: "GROUP_ALREADY_EXISTS" })

    const grupo = await prisma.$transaction(async (tx) => {
        const atualizado = await tx.employeeGroup.update({ where: { id }, data })
        // O cargo de quem está no grupo acompanha o nome (telas e relatórios antigos mostram o cargo)
        await tx.employee.updateMany({ where: { group_id: id }, data: { role: atualizado.name } })
        return atualizado
    })
    return reply.status(200).send(grupo)
}

export async function deleteEmployeeGroup(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamsSchema.parse(request.params)
    const emUso = await prisma.employee.count({ where: { group_id: id } })
    if (emUso > 0) return reply.status(409).send({ message: "GROUP_HAS_EMPLOYEES", employeesCount: emUso })
    await prisma.employeeGroup.delete({ where: { id } })
    return reply.status(204).send()
}

/**
 * O grupo de um funcionário a partir do que a tela mandou: o id escolhido na lista ou, como antes, o cargo digitado
 * (o grupo com esse nome é usado; se não existir, é criado sem acesso a nada). Devolve o grupo e o cargo a gravar.
 */
export async function resolverGrupoDoFuncionario(groupId: string | null | undefined, cargoDigitado: string) {
    if (groupId) {
        const grupo = await prisma.employeeGroup.findUnique({ where: { id: groupId } })
        if (!grupo) return { erro: "GROUP_NOT_FOUND" as const }
        return { grupoId: grupo.id, cargo: grupo.name }
    }
    const nome = normalizarNomeDoGrupo(cargoDigitado)
    if (!nome) return { grupoId: null, cargo: cargoDigitado }
    const acharPeloNome = () => acharGrupoPeloNome(nome)
    const existente = await acharPeloNome()
    if (existente) return { grupoId: existente.id, cargo: existente.name }
    try {
        const novo = await prisma.employeeGroup.create({ data: { name: nome } })
        return { grupoId: novo.id, cargo: novo.name }
    } catch (err: any) {
        // Outra tela criou o mesmo grupo no mesmo instante: usa o dela
        const criadoAgora = err?.code === "P2002" ? await acharPeloNome() : null
        if (!criadoAgora) throw err
        return { grupoId: criadoAgora.id, cargo: criadoAgora.name }
    }
}
