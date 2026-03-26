import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['query'] })

async function main() {
    // Verifica quantas confirmadas têm totalValue NULL vs preenchido
    const nullCount = await prisma.transaction.count({
        where: { confirmed: true, totalValue: null }
    })
    const filledCount = await prisma.transaction.count({
        where: { confirmed: true, totalValue: { not: null } }
    })

    console.log(`Confirmadas com totalValue NULL : ${nullCount}`)
    console.log(`Confirmadas com totalValue preenchido: ${filledCount}`)

    if (nullCount > 0) {
        console.log(`\nAtualizando ${nullCount} registros...`)
        
        // Atualiza em lote puxando o amount de cada registro
        const nullTransactions = await prisma.transaction.findMany({
            where: { confirmed: true, totalValue: null },
            select: { id: true, amount: true }
        })

        for (const t of nullTransactions) {
            await prisma.transaction.update({
                where: { id: t.id },
                data: { totalValue: t.amount }
            })
        }

        console.log(`✅ ${nullCount} transações migradas com sucesso!`)
    } else {
        console.log('\n✅ Todos os registros já têm totalValue preenchido.')
        
        // Debug: mostra a soma atual
        const incomeSum = await prisma.transaction.aggregate({
            _sum: { totalValue: true, amount: true },
            _count: { id: true },
            where: { confirmed: true, operation: 'income' }
        })
        console.log('Receitas confirmadas:', incomeSum)

        const expenseSum = await prisma.transaction.aggregate({
            _sum: { totalValue: true, amount: true },
            _count: { id: true },
            where: { confirmed: true, operation: 'expense' }
        })
        console.log('Despesas confirmadas:', expenseSum)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
