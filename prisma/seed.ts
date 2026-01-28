import { PrismaClient, StockOperation, StockReason } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Função auxiliar para gerar número aleatório entre min e max
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// Função auxiliar para pegar um elemento aleatório de um array
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Função para gerar data com hora aleatória dentro do horário comercial (08:00 - 18:00)
const randomTimeOnDate = (date: Date) => {
    const newDate = new Date(date)
    newDate.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0)
    return newDate
}

async function main() {
    console.log('🌱 Starting realistic seed (60 days simulation)...')

    // ============================
    // 0. LIMPEZA (Opcional - cuidado em prod)
    // ============================
    // Descomente se quiser limpar tudo antes
    // await prisma.transaction.deleteMany()
    // await prisma.stock.deleteMany()
    // await prisma.treatmentItem.deleteMany()
    // await prisma.treatment.deleteMany()
    // await prisma.item.deleteMany()
    // await prisma.equipment.deleteMany()
    // await prisma.client.deleteMany()
    // await prisma.sector.deleteMany()
    // await prisma.account.deleteMany()
    // await prisma.user.deleteMany()

    // ============================
    // 1. USUÁRIOS E CONTAS
    // ============================
    const passwordHash = await hash('123456', 6)

    const admin = await prisma.user.upsert({
        where: { email: 'admin@metrics.com' },
        update: {},
        create: {
            name: 'Admin User',
            email: 'admin@metrics.com',
            password_hash: passwordHash,
            role: 'ADMIN',
        },
    })

    // Contas Bancárias
    const contaPJ = await prisma.account.create({
        data: { name: 'Conta Inter PJ', balance: 5000.00, description: 'Movimento Principal' }
    })

    const carteira = await prisma.account.create({
        data: { name: 'Carteira (Espécie)', balance: 250.00, description: 'Pequenos gastos' }
    })

    // Setores Financeiros
    const secPessoal = await prisma.sector.create({ data: { name: 'Vida Pessoal', type: 'out' } })
    const secFixos = await prisma.sector.create({ data: { name: 'Custos Fixos', type: 'out' } })
    const secVar = await prisma.sector.create({ data: { name: 'Despesas Variáveis', type: 'out' } })
    const secEstoque = await prisma.sector.create({ data: { name: 'Compra Estoque', type: 'out' } })

    const secServicos = await prisma.sector.create({ data: { name: 'Serviços Prestados', type: 'in' } })
    const secVendas = await prisma.sector.create({ data: { name: 'Venda Produtos', type: 'in' } })

    // ============================
    // 2. ITENS DE ESTOQUE (20+ Itens)
    // ============================
    const hardwareData = [
        { name: 'SSD Kingston 480GB', cost: 160, price: 350, cat: 'Armazenamento' },
        { name: 'SSD Kingston 960GB', cost: 280, price: 550, cat: 'Armazenamento' },
        { name: 'HD Seagate 1TB', cost: 220, price: 380, cat: 'Armazenamento' },
        { name: 'Memória RAM 8GB DDR4', cost: 130, price: 280, cat: 'Hardware' },
        { name: 'Memória RAM 16GB DDR4', cost: 220, price: 450, cat: 'Hardware' },
        { name: 'Fonte ATX 500W', cost: 150, price: 290, cat: 'Hardware' },
        { name: 'Gabinete Gamer', cost: 200, price: 400, cat: 'Hardware' },
        { name: 'Placa Mãe H510', cost: 450, price: 750, cat: 'Hardware' },
        { name: 'Processador i5 10400', cost: 700, price: 1100, cat: 'Hardware' },
        { name: 'Kit Teclado + Mouse', cost: 60, price: 120, cat: 'Periféricos' },
    ]

    const networkData = [
        { name: 'Roteador TP-Link Archer C6', cost: 210, price: 420, cat: 'Rede' },
        { name: 'Roteador Mercusys AC1200', cost: 150, price: 280, cat: 'Rede' },
        { name: 'Switch 8 Portas Gigabit', cost: 120, price: 220, cat: 'Rede' },
        { name: 'Cabo Rede CAT5e (Metro)', cost: 1.2, price: 4.0, cat: 'Rede' },
        { name: 'Conector RJ45 (Unidade)', cost: 0.4, price: 2.0, cat: 'Rede' },
    ]

    const securityData = [
        { name: 'Câmera Dome Intelbras', cost: 180, price: 320, cat: 'Segurança' },
        { name: 'Câmera Bullet Intelbras', cost: 190, price: 340, cat: 'Segurança' },
        { name: 'DVR 4 Canais', cost: 350, price: 650, cat: 'Segurança' },
        { name: 'HD Purpler 1TB (CFTV)', cost: 320, price: 580, cat: 'Segurança' },
        { name: 'Fonte Colmeia 12V', cost: 40, price: 90, cat: 'Segurança' },
        { name: 'Conector BNC', cost: 2, price: 5, cat: 'Segurança' },
        { name: 'Cabo Coaxial (Metro)', cost: 1.5, price: 3.5, cat: 'Segurança' },
    ]

    const allItems = [...hardwareData, ...networkData, ...securityData]
    const createdItems = []

    // Criar Itens e Estoque Inicial
    for (const item of allItems) {
        const created = await prisma.item.create({
            data: {
                name: item.name,
                cost: item.cost,
                price: item.price,
                stock: randomInt(5, 30), // Estoque inicial
                min_stock: 5,
                isItem: true,
                category: item.cat,
                active: true
            }
        })
        createdItems.push(created)

        // Lançamento de entrada de estoque (paga pela conta PJ)
        await prisma.stock.create({
            data: {
                item_id: created.id,
                quantity: created.stock || 0,
                operation: 'IN',
                description: 'COMPRA',
                created_at: new Date(new Date().setDate(new Date().getDate() - 70)) // Comprado antes da simulação
            }
        })
    }

    // ============================
    // 3. SIMULAÇÃO: ÚLTIMOS 60 DIAS
    // ============================
    const today = new Date()
    const daysToSimulate = 60

    console.log(`Generating transactions for the last ${daysToSimulate} days...`)

    for (let i = daysToSimulate; i >= 0; i--) {
        const currentDate = new Date()
        currentDate.setDate(today.getDate() - i)
        const day = currentDate.getDate()

        // --- A. DESPESAS FIXAS (Datas Específicas) ---
        const fixedExpenses = [
            { day: 5, desc: 'Internet Fibra', amount: 100.00, sec: secPessoal.id },
            { day: 7, desc: 'Pensão Alimentícia', amount: 750.00, sec: secPessoal.id },
            { day: 10, desc: 'Aluguel do Imóvel', amount: 1200.00, sec: secPessoal.id }, // Valor estimado
            { day: 25, desc: 'Conta de Luz (Enel)', amount: randomInt(180, 220), sec: secPessoal.id },
        ]

        for (const exp of fixedExpenses) {
            if (day === exp.day) {
                await prisma.transaction.create({
                    data: {
                        description: exp.desc,
                        amount: Number(exp.amount),
                        operation: 'out',
                        date: randomTimeOnDate(currentDate),
                        account_id: contaPJ.id,
                        sector_id: exp.sec,
                        confirmed: true
                    }
                })
            }
        }

        // --- B. GASTOS DE "PADARIA" (Pequenos diários) ---
        // 60% de chance de ter gastos pequenos no dia
        if (Math.random() > 0.4) {
            const smallExpenses = [
                'Padaria (Café)', 'Lanche da Tarde', 'Uber para Cliente', 'Gasolina Moto', 'Material Limpeza', 'Almoço PF', 'Saco de Lixo', 'Refrigerante', 'Parafusos Avulsos'
            ]
            const qtdGastos = randomInt(1, 3) // 1 a 3 gastos por dia

            for (let k = 0; k < qtdGastos; k++) {
                await prisma.transaction.create({
                    data: {
                        description: randomItem(smallExpenses),
                        amount: randomInt(10, 50),
                        operation: 'out',
                        date: randomTimeOnDate(currentDate),
                        account_id: carteira.id, // Sai da carteira
                        sector_id: secVar.id,
                        confirmed: true
                    }
                })
            }
        }

        // --- C. ENTRADAS: SERVIÇOS E VENDAS ---
        // 80% de chance de ter receita no dia (exceto Domingo)
        if (currentDate.getDay() !== 0 && Math.random() > 0.2) {
            const qtdReceitas = randomInt(1, 3)

            for (let r = 0; r < qtdReceitas; r++) {
                const isService = Math.random() > 0.5 // 50% chance ser serviço ou venda

                if (isService) {
                    // SERVIÇO (Sem baixa de estoque físico)
                    const servicos = [
                        'Formatação PC', 'Visita Técnica', 'Configuração Roteador', 'Limpeza Interna PC', 'Backup de Dados', 'Instalação Impressora', 'Crimpar Cabos'
                    ]
                    await prisma.transaction.create({
                        data: {
                            description: randomItem(servicos),
                            amount: randomInt(80, 250),
                            operation: 'in', // Entrada
                            date: randomTimeOnDate(currentDate),
                            account_id: contaPJ.id,
                            sector_id: secServicos.id,
                            confirmed: true
                        }
                    })
                } else {
                    // VENDA DE PEÇA (Baixa Estoque)
                    const itemVenda = randomItem(createdItems)
                    const qtdVenda = randomInt(1, 2)

                    // Verificar se tem estoque (simulação simples)
                    // Na vida real faria a query, aqui vamos assumir que tem pelo seed inicial

                    // Registrar Transação Financeira
                    await prisma.transaction.create({
                        data: {
                            description: `Venda: ${itemVenda.name}`,
                            amount: itemVenda.price * qtdVenda,
                            operation: 'in',
                            date: randomTimeOnDate(currentDate),
                            account_id: contaPJ.id,
                            sector_id: secVendas.id,
                            confirmed: true
                        }
                    })

                    // Registrar Baixa no Estoque (History)
                    // Nota: Para fins de seed rápido, não estou criando o objeto Treatment/Client completo para cada venda,
                    // apenas a movimentação financeira e de estoque para validar os gráficos.
                    await prisma.stock.create({
                        data: {
                            item_id: itemVenda.id,
                            quantity: qtdVenda,
                            operation: StockOperation.OUT,
                            description: StockReason.VENDA,
                            created_at: randomTimeOnDate(currentDate)
                        }
                    })

                    // Atualizar quantidade atual do item (simulado)
                    /* 
                       Em um cenário real de app, usaria o update com { decrement: qtd }. 
                       Aqui no seed massivo, para performance, podemos pular ou fazer se for crítico.
                       Vou fazer para garantir consistência.
                    */
                    await prisma.item.update({
                        where: { id: itemVenda.id },
                        data: { stock: { decrement: qtdVenda } }
                    })
                }
            }
        }
    }

    console.log('✅ Seed completed! Database is now populated with 60 days of financial history.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
