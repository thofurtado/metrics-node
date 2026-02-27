import { PrismaClient } from '@prisma/client'

export async function seedMarujo(prisma: PrismaClient) {
    console.log('🍤 Seeding Marujo Gastro Bar data...')

    const catMarujo1 = await prisma.category.create({ data: { name: 'Porções' } })
    const catMarujo2 = await prisma.category.create({ data: { name: 'Especiais Marujo' } })
    const catKids = await prisma.category.create({ data: { name: 'Espaço Kids' } })

    await prisma.product.create({
        data: {
            name: 'Palmito Caiçara',
            price: 79.90,
            active: true,
            display_id: 9901,
            category_id: catMarujo2.id,
            description: 'Tricampeão do Caraguá a Gosto.'
        }
    })

    await prisma.product.create({
        data: {
            name: 'Sereníssima',
            price: 89.90,
            active: true,
            display_id: 9902,
            category_id: catMarujo2.id,
        }
    })

    await prisma.product.create({
        data: {
            name: 'Combo Fliperama Premium',
            price: 49.90,
            active: true,
            display_id: 9903,
            category_id: catKids.id,
            description: 'Para as crianças se divertirem no escorregador gigante.'
        }
    })

    console.log('✅ Marujo Context Seeded!')
}
