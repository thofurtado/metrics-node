import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'

export async function getPaymentAgenda(request: FastifyRequest, reply: FastifyReply) {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const tenDaysFromNow = new Date(today)
        tenDaysFromNow.setDate(today.getDate() + 9)
        tenDaysFromNow.setHours(23, 59, 59, 999)

        const transactions = await prisma.transaction.findMany({
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: {
                    gte: today,
                    lte: tenDaysFromNow,
                }
            },
            include: {
                sectors: true
            },
            orderBy: {
                data_vencimento: 'asc'
            }
        })

        // Agrupar por data (usando chave 'yyyy-MM-dd' para ordenar corretamente)
        const agendaMap: Record<string, { data: string, dateObj: Date, total: number, detalhes: any[] }> = {}

        for (let i = 0; i < 10; i++) {
            const currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            const year = currentDate.getFullYear()
            const month = String(currentDate.getMonth() + 1).padStart(2, '0')
            const day = String(currentDate.getDate()).padStart(2, '0')
            const key = `${year}-${month}-${day}`
            const dataStr = `${day}/${month}`

            agendaMap[key] = {
                data: dataStr,
                dateObj: currentDate,
                total: 0,
                detalhes: []
            }
        }

        transactions.forEach(tx => {
            const d = tx.data_vencimento
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const key = `${year}-${month}-${day}`

            if (agendaMap[key]) {
                const amount = Number(tx.amount)
                agendaMap[key].total += amount
                agendaMap[key].detalhes.push({
                    descricao: tx.description || 'Sem descrição',
                    valor: amount,
                    categoria: tx.sectors?.name || 'Sem categoria'
                })
            }
        })

        const result = Object.values(agendaMap)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(({ data, total, detalhes }) => ({ data, total, detalhes }))

        return reply.status(200).send(result)

    } catch (err) {
        console.error('[getPaymentAgenda] Error:', err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
