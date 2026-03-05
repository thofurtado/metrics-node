import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const startDate = '2026-03-01'
        const endDate = '2026-03-31'
        console.log(`Buscando pontos de ${startDate} a ${endDate}...`)

        const timeClocks = await prisma.timeClock.findMany({
            where: {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            include: {
                employee: { select: { name: true, role: true } }
            },
            take: 5
        })

        console.log('Resultados:', timeClocks.length)
        console.dir(timeClocks, { depth: null })
    } catch (err) {
        console.error('ERRO AO BUSCAR:', err)
    } finally {
        await prisma.$disconnect()
    }
}

main()
