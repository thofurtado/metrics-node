import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'

export async function getPaymentAgenda(request: FastifyRequest, reply: FastifyReply) {
    try {
        // O servidor roda fixo em America/Sao_Paulo (ver src/server.ts), então new Date() já é
        // hora de Brasília — sem conversão manual.
        const localNow = new Date()

        const today = new Date(localNow)
        today.setHours(0, 0, 0, 0)

        const tenDaysFromNow = new Date(today)
        tenDaysFromNow.setDate(today.getDate() + 9)
        tenDaysFromNow.setHours(23, 59, 59, 999)

        const transactions = await prisma.transaction.findMany({
            where: {
                operation: 'expense',
                confirmed: false,
                // Compra individual no cartão de crédito não aparece aqui: ela some numa fatura só
                // (ver abaixo), do mesmo jeito que a lista de Transações já mostra.
                OR: [
                    { credit_card_id: null },
                    { payment_method: { not: 'CREDIT_CARD' } }
                ],
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

        // Compras no cartão de crédito: uma linha por cartão (a fatura), não uma por compra —
        // mesma regra da lista de Transações (prisma-transactions-repository.ts).
        const creditCardSwipes = await prisma.transaction.findMany({
            where: {
                payment_method: 'CREDIT_CARD',
                credit_card_id: { not: null },
                confirmed: false,
                data_vencimento: { gte: today, lte: tenDaysFromNow }
            },
            include: { creditCard: true }
        })
        const invoicesByCardAndDay = new Map<string, { dayKey: string, description: string, amount: number }>()
        for (const swipe of creditCardSwipes) {
            if (!swipe.credit_card_id || !swipe.creditCard) continue
            const d = swipe.data_vencimento
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const invoiceKey = `${swipe.credit_card_id}-${dayKey}`
            const current = invoicesByCardAndDay.get(invoiceKey)
            const swipeAmount = Number(swipe.totalValue ?? swipe.amount)
            if (current) {
                current.amount += swipeAmount
            } else {
                invoicesByCardAndDay.set(invoiceKey, {
                    dayKey,
                    description: `Fatura Cartão: ${swipe.creditCard.name}`,
                    amount: swipeAmount
                })
            }
        }

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
                    categoria: tx.sectors?.name || 'Sem categoria',
                    payment_method: tx.payment_method
                })
            }
        })

        for (const invoice of invoicesByCardAndDay.values()) {
            if (agendaMap[invoice.dayKey]) {
                agendaMap[invoice.dayKey].total += invoice.amount
                agendaMap[invoice.dayKey].detalhes.push({
                    descricao: invoice.description,
                    valor: Number(invoice.amount.toFixed(2)),
                    categoria: 'Cartão de Crédito',
                    payment_method: 'CREDIT_CARD'
                })
            }
        }

        const result = Object.values(agendaMap)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(({ data, total, detalhes }) => ({ data, total, detalhes }))

        return reply.status(200).send(result)

    } catch (err) {
        console.error('[getPaymentAgenda] Error:', err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
