import { PrismaClient } from '@prisma/client'
import { seedMarujo } from './seeds/marujo'
import { seedEureca } from './seeds/eureca'

const prisma = new PrismaClient()

async function main() {
    const context = process.env.CLIENT_CONTEXT || 'marujo'
    console.log(`🌱 Starting E2E Seed for context: [${context.toUpperCase()}]`)

    // Zerar dados conflitantes (limpeza bottom-up global)
    await prisma.treatmentItem.deleteMany()
    await prisma.treatment.deleteMany()
    await prisma.client.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()

    // Factory Pattern: Delega a responsabilidade de criação para o pacote agnóstico
    if (context === 'marujo') {
        await seedMarujo(prisma)
    } else if (context === 'eureca') {
        await seedEureca(prisma)
    } else {
        console.warn(`⚠️ Warning: CLIENT_CONTEXT '${context}' unknown. Running empty base.`)
    }

    console.log('✅ Global E2E Seed Factory finished!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
