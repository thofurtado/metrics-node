import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const payload = [
    {
        "category": "Bebidas Não Alcoólicas",
        "products": [
            { "name": "Green Limonade", "price": 29.90, "description": "" },
            { "name": "Blue Limonade", "price": 29.90, "description": "" },
            { "name": "Pink Lemonade", "price": 29.90, "description": "" },
            { "name": "Água com gás", "price": 7.50, "description": "" },
            { "name": "Água sem gás", "price": 7.50, "description": "" },
            { "name": "Refrigerante", "price": 8.90, "description": "" },
            { "name": "Energético Red Bull", "price": 18.90, "description": "" },
            { "name": "Água Tônica", "price": 8.90, "description": "" },
            { "name": "Schweppes Citrus", "price": 9.90, "description": "" },
            { "name": "Del Valle", "price": 9.90, "description": "" }
        ]
    },
    {
        "category": "Café",
        "products": [
            { "name": "Café Expresso", "price": 7.90, "description": "" },
            { "name": "Café com Leite Pequeno", "price": 8.90, "description": "" },
            { "name": "Café com Leite Médio", "price": 10.90, "description": "" },
            { "name": "Capuccino Médio", "price": 16.90, "description": "" }
        ]
    },
    {
        "category": "Sucos (350ml)",
        "products": [
            { "name": "Suco de Laranja", "price": 19.90, "description": "Natural" },
            { "name": "Suco de Limão", "price": 17.90, "description": "Natural" },
            { "name": "Limonada Suíça", "price": 22.90, "description": "" },
            { "name": "Suco de Abacaxi com Hortelã", "price": 19.90, "description": "" },
            { "name": "Suco de Maracujá", "price": 19.90, "description": "" },
            { "name": "Suco de Frutas Vermelhas", "price": 21.90, "description": "" },
            { "name": "Jarra de Suco 1,3L", "price": 76.00, "description": "" }
        ]
    },
    {
        "category": "Cervejas e Chopp",
        "products": [
            { "name": "Petra 600ml", "price": 16.90, "description": "" },
            { "name": "Serramalte 600ml", "price": 22.90, "description": "" },
            { "name": "Stella Artois Long Neck", "price": 14.90, "description": "" },
            { "name": "Corona 600ml", "price": 24.90, "description": "" },
            { "name": "Corona Long Neck", "price": 14.90, "description": "" },
            { "name": "Heineken 600ml", "price": 24.90, "description": "" },
            { "name": "Heineken Long Neck", "price": 14.90, "description": "" },
            { "name": "Chopp Pilsen 300ml", "price": 15.90, "description": "" },
            { "name": "Chopp Pilsen 600ml", "price": 24.90, "description": "" }
        ]
    },
    {
        "category": "Drinks & Coquetéis",
        "products": [
            { "name": "Caipirinha / Saquê Nacional", "price": 31.90, "description": "Kiwi, Brasileirinha, Maracujá, Morango, Frutas vermelhas, Tropical, Abacaxi ou Pitaya" },
            { "name": "Cosmopolitan", "price": 38.00, "description": "" },
            { "name": "Mestre dos Mares", "price": 35.90, "description": "" },
            { "name": "Gin Tônica Nacional", "price": 34.90, "description": "Gin, água tônica e sabor (limão, morango, frutas vermelhas ou limão siciliano)" },
            { "name": "Moscow Mule", "price": 39.00, "description": "Vodka, infusão de limão e gengibre e espuma de gengibre" }
        ]
    },
    {
        "category": "Entradas",
        "products": [
            { "name": "Couvert", "price": 44.00, "description": "Cesta de pães e 3 patês: atum, azeitona e tomate seco" },
            { "name": "Casquinha de Siri", "price": 54.00, "description": "Carne de siri gratinada com parmesão" },
            { "name": "Ostras (8 un)", "price": 74.00, "description": "Ostravagante" },
            { "name": "Ceviche", "price": 92.00, "description": "Salmão ou peixe branco 250g" },
            { "name": "Coquetel de Camarão", "price": 134.00, "description": "" }
        ]
    },
    {
        "category": "Porções (Frutos do Mar)",
        "products": [
            { "name": "Bolinho de Bacalhau (8 un)", "price": 74.00, "description": "" },
            { "name": "Lombo de cação à dorê", "price": 98.00, "description": "" },
            { "name": "Camarão a dorê", "price": 99.00, "description": "" },
            { "name": "Camarão rosa alho e azeite", "price": 144.00, "description": "Acompanha pão" },
            { "name": "Isca de peixe", "price": 94.00, "description": "" },
            { "name": "Lula a dorê", "price": 110.00, "description": "" }
        ]
    },
    {
        "category": "Risotos",
        "products": [
            { "name": "Risoto a moda do Chef", "price": 229.00, "description": "Risoto de palmito palmeira real com ervas. Acompanha steak de entrecorte ao molho madeira" },
            { "name": "Risoto de camarão", "price": 299.00, "description": "Camarões rosa pequenos, molho a base de leite de coco, azeite de dendê, pimentão, cebola, tomate" },
            { "name": "Risoto ao marujo", "price": 329.00, "description": "Isca de peixe, camarão, lula, polvo, mexilhão, molho a base de leite de coco e dendê" }
        ]
    },
    {
        "category": "Pratos Vencedores (Caraguá a Gosto)",
        "products": [
            { "name": "Palmito a caiçara", "price": 299.00, "description": "Palmito de pupunha selvagem, camarão rosa e polvo grelhado no char broiler, banana da terra, mandioca frita e arroz branco" },
            { "name": "Sororoca a mediterrâneo", "price": 289.00, "description": "Entrada: mini baguete com escabeche. Prato: filé de sororoca com crosta de castanha, banana grelhada, crispy de taioba e risoto de palmito" },
            { "name": "Capitain’s lasagna", "price": 298.00, "description": "Lasanha de pescada branca com banana da terra grelhada. Acompanha arroz branco e lula à provençal recheada com siri" }
        ]
    },
    {
        "category": "Pizzas Tradicionais",
        "products": [
            { "name": "Pizza Napole (Broto)", "price": 60.90, "description": "Molho de tomate fresco, mozzarela premium, parmesão e tomate" },
            { "name": "Pizza Napole (Inteira)", "price": 86.90, "description": "Molho de tomate fresco, mozzarela premium, parmesão e tomate" },
            { "name": "Pizza Margherita (Broto)", "price": 60.90, "description": "Molho de tomate, mozzarella, fatias de tomate, parmesão e manjericão fresco" },
            { "name": "Pizza Margherita (Inteira)", "price": 85.90, "description": "Molho de tomate, mozzarella, fatias de tomate, parmesão e manjericão fresco" },
            { "name": "Pizza Frango com Catupiry (Broto)", "price": 74.90, "description": "Molho de tomate, peito de frango desfiado e catupiry" },
            { "name": "Pizza Frango com Catupiry (Inteira)", "price": 106.00, "description": "Molho de tomate, peito de frango desfiado e catupiry" }
        ]
    },
    {
        "category": "Pizzas Especiais",
        "products": [
            { "name": "Pizza Sete Mares (Broto)", "price": 139.90, "description": "Molho de tomate, polvo, lula, camarão, marisco, pimentão e cream cheese" },
            { "name": "Pizza Sete Mares (Inteira)", "price": 199.90, "description": "Molho de tomate, polvo, lula, camarão, marisco, pimentão e cream cheese" }
        ]
    },
    {
        "category": "Lanches",
        "products": [
            { "name": "X-Siri", "price": 79.00, "description": "Hamburguer de carne de siri empanado na panko (200g), queijo, molho tártaro, alface, tomate, cebola roxa e fritas" },
            { "name": "X-Marujo", "price": 98.00, "description": "Hambúrguer black angus (200g), queijo prato, bacon, ovo, catupiry empanado, alface, tomate, cebola e fritas" }
        ]
    }
]

async function main() {
    console.log('Iniciando script de seed do cardápio do Marujo...')

    // Obter o display_id máximo atual para evitar colisões
    const maxProduct = await prisma.product.aggregate({
        _max: {
            display_id: true
        }
    })

    // Vamos começar de um ID alto como fallback (ex: 200000) caso não tenha nenhum
    let currentDisplayId = (maxProduct._max.display_id || 200000) + 1

    for (const item of payload) {
        // 1. Encontra ou cria a categoria
        console.log(`\nProcessando categoria: ${item.category}`)
        const categoryName = item.category.trim()

        let category = await prisma.category.findUnique({
            where: { name: categoryName }
        })

        if (!category) {
            category = await prisma.category.create({
                data: { name: categoryName }
            })
            console.log(`[+] Categoria criada: ${category.name}`)
        } else {
            console.log(`[=] Categoria já existente: ${category.name}`)
        }

        // 2. Cria os produtos vinculados à categoria
        for (const prodData of item.products) {
            // Verifica se o produto já existe no database para não clonar
            const existingProduct = await prisma.product.findFirst({
                where: {
                    name: prodData.name,
                    category_id: category.id
                }
            })

            if (!existingProduct) {
                await prisma.product.create({
                    data: {
                        name: prodData.name,
                        description: prodData.description || null,
                        price: prodData.price,
                        active: true,
                        display_id: currentDisplayId++,
                        category_id: category.id,
                        cost: 0,
                        stock: 0,
                        min_stock: 0,
                        is_composite: false
                    }
                })
                console.log(`   └─ [Criado] ${prodData.name} - R$ ${prodData.price.toFixed(2)}`)
            } else {
                console.log(`   └─ [Pulado] ${prodData.name} já existe.`)
            }
        }
    }

    console.log('\n✅ Seed finalizado com sucesso!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
