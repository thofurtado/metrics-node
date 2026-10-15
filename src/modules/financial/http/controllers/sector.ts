import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { UserAlreadyExistsError } from '@/modules/users/use-cases/user-already-exists-error'
import { MakeSectorUseCase } from '@/modules/sectors/use-cases/factories/make-sector-use-case'
import { prisma } from '@/lib/prisma'




export async function createSector(request: FastifyRequest, reply: FastifyReply) {

    try {
        // Log payload for debugging
        console.log('[CreateSector] Payload:', JSON.stringify(request.body, null, 2))

        const registerBodySchema = z.object({
            name: z.string(),
            budget: z.number().nullable().optional(),
            type: z.string()
        })

        const { name, budget, type } = registerBodySchema.parse(request.body)

        const sectorUseCase = MakeSectorUseCase()
        const { sector } = await sectorUseCase.execute({
            name,
            budget: budget ?? undefined,
            type
        })
        return reply.status(201).send(sector)
    } catch (err) {
        console.error('[CreateSector] Error:', err)
        if (err instanceof z.ZodError) {
            return reply.status(400).send({ message: 'Validation error', issues: err.format() })
        }
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}



// Fase 4 do Mergulho (17:U9): antes o setor (categoria de receita/despesa) só podia ser criado; nome digitado errado ou
// setor que não se usa mais ficavam para sempre na lista. Agora o administrador renomeia e exclui (só o setor sem
// nenhum lançamento: com lançamentos, excluir apagaria a categoria do histórico; renomeie em vez disso).
const sectorParamsSchema = z.object({ id: z.string().uuid() })

export async function updateSector(request: FastifyRequest, reply: FastifyReply) {
    const { id } = sectorParamsSchema.parse(request.params)
    const bodySchema = z.object({
        name: z.string().trim().min(1, 'Informe o nome do setor.').optional(),
        budget: z.number().nullable().optional(),
        type: z.enum(['in', 'out']).optional(),
    })
    const data = bodySchema.parse(request.body)

    const atual = await prisma.sector.findUnique({ where: { id }, select: { id: true } })
    if (!atual) {
        return reply.status(404).send({ message: 'Setor não encontrado.' })
    }
    const sector = await prisma.sector.update({ where: { id }, data })
    return reply.status(200).send(sector)
}

export async function deleteSector(request: FastifyRequest, reply: FastifyReply) {
    const { id } = sectorParamsSchema.parse(request.params)

    const atual = await prisma.sector.findUnique({ where: { id }, select: { id: true } })
    if (!atual) {
        return reply.status(404).send({ message: 'Setor não encontrado.' })
    }
    const [lancamentos, caixa] = await Promise.all([
        prisma.transaction.count({ where: { sector_id: id } }),
        prisma.cashierEntry.count({ where: { sector_id: id } }),
    ])
    if (lancamentos + caixa > 0) {
        return reply.status(409).send({
            code: 'SECTOR_IN_USE',
            message: `Este setor tem ${lancamentos + caixa} lançamento(s) e não pode ser excluído. Renomeie em vez de excluir.`,
        })
    }
    await prisma.sector.delete({ where: { id } })
    return reply.status(204).send()
}
