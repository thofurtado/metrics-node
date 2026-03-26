import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log('Iniciando migração de totalValue para transações confirmadas...')
        const result = await prisma.$executeRaw`UPDATE transactions SET "totalValue" = amount WHERE "totalValue" IS NULL AND confirmed = true`
        console.log(`Migração concluída com sucesso! Linhas afetadas: ${result}`)
    } catch (error) {
        console.error('Erro na migração:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
