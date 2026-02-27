import { PrismaClient } from '@prisma/client'

export async function seedEureca(prisma: PrismaClient) {
    console.log('💻 Seeding Eureca Tech data...')

    const catEureca1 = await prisma.category.create({ data: { name: 'Sistemas Web' } })
    const catEureca2 = await prisma.category.create({ data: { name: 'Consultoria' } })

    await prisma.product.create({
        data: {
            name: 'Plataforma E2E',
            price: 15000.00,
            active: true,
            display_id: 1001,
            category_id: catEureca1.id,
            description: 'Sistema web completo full-stack em React e Node.js'
        }
    })

    await prisma.product.create({
        data: {
            name: 'Hora de Consultoria Tech',
            price: 250.00,
            active: true,
            display_id: 1002,
            category_id: catEureca2.id,
            description: 'Consultoria arquitetural especializada'
        }
    })

    console.log('✅ Eureca Context Seeded!')
}
