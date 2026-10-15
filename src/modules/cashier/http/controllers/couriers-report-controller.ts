import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { diaOperacional } from '@/lib/dia-operacional'
import { relatorioDosMotoboys } from '@/modules/pdv-sync/services/motoboys-do-pdv'

/**
 * Relatório dos motoboys na web (15/10/2026, plano 2.5 e 3): o que o PDV mandou (motoboys e entregas/diárias a pagar), só
 * leitura. Por motoboy no período: entregas, diárias, ganho, pago (dinheiro/Pix), pendente e o dia a dia. Fica com a trava
 * do Caixa (Caixa ou Financeiro), como as outras rotas /api/cashier/*.
 */

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato aaaa-mm-dd.')

const periodoSchema = z.object({
    startDate: dia.optional(),
    endDate: dia.optional(),
})

/** Sem período: do dia 1º do mês até hoje (dia operacional de Brasília). */
function periodo(query: unknown): { de: string; ate: string } {
    const { startDate, endDate } = periodoSchema.parse(query)
    const hoje = diaOperacional()
    const ate = endDate ?? hoje
    const de = startDate ?? `${ate.slice(0, 7)}-01`
    return de <= ate ? { de, ate } : { de: ate, ate: de }
}

export async function getCouriers(request: FastifyRequest, reply: FastifyReply) {
    const motoboys = await prisma.deliveryCourier.findMany({ orderBy: { name: 'asc' } })
    return reply.status(200).send(motoboys)
}

export async function getCouriersReport(request: FastifyRequest, reply: FastifyReply) {
    const { de, ate } = periodo(request.query)
    const [linhas, motoboys] = await Promise.all([
        prisma.courierPayable.findMany({
            where: { day: { gte: de, lte: ate } },
            select: { courier_uuid: true, kind: true, day: true, amount_due: true, status: true, payment_method: true },
        }),
        prisma.deliveryCourier.findMany({
            select: { id: true, name: true, active: true, earning_mode: true, value_per_delivery: true, daily_rate: true },
        }),
    ])
    return reply.status(200).send({ periodo: { startDate: de, endDate: ate }, ...relatorioDosMotoboys(linhas, motoboys) })
}

/** As linhas de um motoboy no período (o detalhe de cada entrega/diária: pedido, valor, situação, acerto, forma). */
export async function getCourierPayables(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { de, ate } = periodo(request.query)
    const linhas = await prisma.courierPayable.findMany({
        where: { courier_uuid: id, day: { gte: de, lte: ate } },
        orderBy: [{ day: 'asc' }, { occurred_at: 'asc' }],
    })
    return reply.status(200).send({ periodo: { startDate: de, endDate: ate }, linhas })
}
