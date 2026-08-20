import { PrismaClient, Role, MeasureUnit, StockOperation, StockReason, PayrollType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_restaurante?schema=public"
        }
    }
})

async function main() {
    console.log('🚀 Iniciando População Massiva de 60 Dias no db_restaurante...')

    // 1. Limpar tabelas mantendo integridade
    console.log('🧹 Limpando dados existentes...')
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
            "sale_items", "sales", "cashier_entries", "client_tabs", "cashier_sessions",
            "treatment_transactions", "transfer_transactions", "installment_payments", "payroll_entries", "transactions", "transaction_groups",
            "stocks", "compositions", "product_complement_groups", "complement_options", "complement_groups",
            "product_print_departments", "print_departments", "treatment_items", "interactions", "treatments", "equipments",
            "products", "subcategories", "categories", "services", "supplies",
            "pos_machine_rates", "pos_machines", "payment_identifiers", "payments", "payment_conditions",
            "account_adjustments", "credit_cards", "accounts", "sectors", "suppliers",
            "business_hours", "company_profiles", "addresses", "clients", "time_clocks", "employee_point_snapshots", "employees", "user_modules", "users", "system_configs"
        CASCADE;
    `)

    const passwordHash = await bcrypt.hash('T0p1nf0r!', 8)

    // 2. Criar Configurações e Perfil da Empresa
    console.log('🏢 Criando Perfil da Empresa & Configurações...')
    await prisma.systemConfig.create({
        data: {
            merchandise_module: true,
            financial_module: true,
            treatments_module: true,
            cashier_module: true,
            cashier_default_origin: 'Mesa',
            blind_cashier_closure: false,
            hr_module: true,
            cestaBasicaValue: 150.00,
            financial_management_profile: 'ANALYTICAL'
        }
    })

    const company = await prisma.companyProfile.create({
        data: {
            tradeName: 'Bella Gourmet - Restaurante & Pizzaria',
            companyName: 'Bella Gourmet Alimentos e Gastronomia Ltda',
            document: '42.185.903/0001-77',
            whatsappNumber: '11987654321',
            street: 'Av. Gastronômica das Flores',
            number: '1250',
            neighborhood: 'Jardins',
            city: 'São Paulo',
            state: 'SP',
            zipcode: '01420-001',
            primaryColor: '#E11D48',
            secondaryColor: '#FFFFFF',
            backgroundColor: '#0F172A',
            deliveryFee: 7.50,
            minOrderValue: 35.00,
            deliveryTimeMin: 35,
            deliveryTimeMax: 55,
            isOpenManual: true,
            pixKey: '42.185.903/0001-77'
        }
    })

    for (let day = 0; day <= 6; day++) {
        await prisma.businessHour.create({
            data: {
                company_profile_id: company.id,
                dayOfWeek: day,
                openTime: '11:30',
                closeTime: '23:30',
                isOpen: true
            }
        })
    }

    // 3. Criar Usuários e Funcionários
    console.log('👥 Criando Usuários e Equipe de Funcionários...')
    const adminUser = await prisma.user.create({
        data: {
            name: 'Thomás Furtado (Proprietário)',
            email: 'admin@restaurante.com',
            role: Role.ADMIN,
            password_hash: passwordHash,
            introduction: 'Administrador Geral da Casa'
        }
    })

    const cashierUser = await prisma.user.create({
        data: {
            name: 'Ana Cláudia (Operadora de Caixa)',
            email: 'caixa@restaurante.com',
            role: Role.CASHIER,
            password_hash: passwordHash
        }
    })

    const empPizzaiolo = await prisma.employee.create({
        data: {
            name: 'Carlos Alberto (Pizzaiolo Chefe)',
            salary: 3400.00,
            role: 'Pizzaiolo',
            admissionDate: new Date('2024-01-15'),
            pin: '1234',
            user_id: adminUser.id
        }
    })

    const empGarcom = await prisma.employee.create({
        data: {
            name: 'Marcos Vinícius (Garçom Salão)',
            salary: 1950.00,
            role: 'Garçom',
            admissionDate: new Date('2024-03-01'),
            pin: '2345'
        }
    })

    const empMotoboy = await prisma.employee.create({
        data: {
            name: 'Lucas Ferreira (Motoboy Líder)',
            salary: 1750.00,
            role: 'Motoboy',
            admissionDate: new Date('2024-05-10'),
            pin: '3456'
        }
    })

    // 4. Contas Bancárias, Setores e Fornecedores
    console.log('🏦 Criando Contas, Setores e Fornecedores...')
    const accBB = await prisma.account.create({
        data: { name: 'Banco do Brasil - Conta Operacional', description: 'Ag: 1234-5 CC: 98765-4', balance: 48500.00 }
    })
    const accItau = await prisma.account.create({
        data: { name: 'Itaú Empresas - Reserva Financeira', description: 'Ag: 0987 CC: 54321-0', balance: 35000.00 }
    })
    const accCofre = await prisma.account.create({
        data: { name: 'Cofre Loja (Dinheiro em Espécie)', description: 'Cofre Físico Gaveta', balance: 3200.00 }
    })

    const secVendas = await prisma.sector.create({ data: { name: 'Receita de Vendas (Restaurante & Delivery)', type: 'in', budget: 120000.00 } })
    const secInsumos = await prisma.sector.create({ data: { name: 'Custos de Insumos & Alimentos (CMV)', type: 'out', budget: 35000.00 } })
    const secBebidas = await prisma.sector.create({ data: { name: 'Custos de Bebidas', type: 'out', budget: 15000.00 } })
    const secOperacional = await prisma.sector.create({ data: { name: 'Despesas Fixas & Operacionais', type: 'out', budget: 18000.00 } })
    const secPessoal = await prisma.sector.create({ data: { name: 'Folha de Pagamento & Equipe', type: 'out', budget: 22000.00 } })

    const supLaticinios = await prisma.supplier.create({ data: { name: 'Laticínios Serra da Canastra', document: '18.945.123/0001-09', phone: '11977771111', email: 'vendas@serralaticinios.com.br' } })
    const supCarnes = await prisma.supplier.create({ data: { name: 'Frigorífico Boi Nobre & Angus', document: '24.111.222/0001-33', phone: '11988882222', email: 'pedidos@boinobre.com.br' } })
    const supHortifruti = await prisma.supplier.create({ data: { name: 'Distribuidora Hortifruti Ceasa Central', document: '07.333.444/0001-55', phone: '11999993333', email: 'comercial@hortifruti.com.br' } })
    const supBebidas = await prisma.supplier.create({ data: { name: 'Ambev & Heineken Bebidas Brasil', document: '02.444.555/0001-66', phone: '11966664444', email: 'pedidos@ambev.com.br' } })
    const supEmbalagens = await prisma.supplier.create({ data: { name: 'PackGourmet Embalagens Sustentáveis', document: '31.555.666/0001-77', phone: '11955555555', email: 'vendas@packgourmet.com.br' } })

    // 5. Formas de Pagamento & POS
    console.log('💳 Criando Formas de Pagamento e Maquininhas POS...')
    await prisma.payment.create({ data: { name: 'Dinheiro', in_sight: true, installment_limit: 1, account_id: accCofre.id, sefaz_tPag: '01' } })
    await prisma.payment.create({ data: { name: 'Pix', in_sight: true, installment_limit: 1, account_id: accBB.id, sefaz_tPag: '17' } })
    await prisma.payment.create({ data: { name: 'Cartão de Crédito', in_sight: false, installment_limit: 12, account_id: accBB.id, sefaz_tPag: '03' } })
    await prisma.payment.create({ data: { name: 'Cartão de Débito', in_sight: true, installment_limit: 1, account_id: accBB.id, sefaz_tPag: '04' } })
    await prisma.payment.create({ data: { name: 'Vale Refeição (VR/Sodexo/Alelo)', in_sight: false, installment_limit: 1, account_id: accBB.id, sefaz_tPag: '10' } })

    const posStone = await prisma.pOSMachine.create({ data: { name: 'Stone Salão Principal', account_id: accBB.id, active: true } })
    await prisma.pOSMachineRate.createMany({
        data: [
            { pos_machine_id: posStone.id, payment_category: 'DEBIT', installments: 1, tax_percentage: 1.15, settlement_days: 1 },
            { pos_machine_id: posStone.id, payment_category: 'CREDIT', installments: 1, tax_percentage: 2.35, settlement_days: 30 },
            { pos_machine_id: posStone.id, payment_category: 'PIX', installments: 1, tax_percentage: 0.45, settlement_days: 0 },
        ]
    })

    // 6. Departamentos de Impressão
    console.log('🖨️ Criando Departamentos de Impressão...')
    const depCozinha = await prisma.printDepartment.create({ data: { name: 'Cozinha & Chapas (KDS)' } })
    const depForno = await prisma.printDepartment.create({ data: { name: 'Forno de Pizza' } })
    const depBar = await prisma.printDepartment.create({ data: { name: 'Bar & Bebidas' } })

    // 7. Categorias & Subcategorias
    console.log('📂 Criando Categorias e Subcategorias...')
    const catPizzas = await prisma.category.create({ data: { name: 'Pizzas Artesanais' } })
    const catBurgers = await prisma.category.create({ data: { name: 'Burgers Gourmet' } })
    const catEntradas = await prisma.category.create({ data: { name: 'Entradas & Porções' } })
    const catBebidas = await prisma.category.create({ data: { name: 'Bebidas & Drinks' } })
    const catSobremesas = await prisma.category.create({ data: { name: 'Sobremesas' } })

    const subPizzasTrad = await prisma.subcategory.create({
        data: { name: 'Pizzas Tradicionais (8 Fatias)', category_id: catPizzas.id, accepts_fractions: true, max_fractions: 2 }
    })
    const subPizzasEsp = await prisma.subcategory.create({
        data: { name: 'Pizzas Especiais & Premium', category_id: catPizzas.id, accepts_fractions: true, max_fractions: 2 }
    })
    const subBurgers = await prisma.subcategory.create({
        data: { name: 'Burgers Artesanais Angus', category_id: catBurgers.id, accepts_fractions: false, max_fractions: 1 }
    })

    // 8. Insumos (Aba 2 - Supplies)
    console.log('🧂 Criando Insumos (Aba 2) com Custos e Estoques...')
    await prisma.supply.create({ data: { name: 'Farinha de Trigo Italiana 00 (Saco 25kg)', cost: 145.00, stock: 12, unit: 'UN', category: 'Secos' } })
    const supMucarela = await prisma.supply.create({ data: { name: 'Queijo Muçarela Especial Fatiada/Ralada (kg)', cost: 32.50, stock: 85.5, unit: 'KG', category: 'Laticínios' } })
    const supGorgonzola = await prisma.supply.create({ data: { name: 'Queijo Gorgonzola D.O.P. (kg)', cost: 68.00, stock: 15.0, unit: 'KG', category: 'Laticínios' } })
    const supParmesao = await prisma.supply.create({ data: { name: 'Queijo Parmesão Curado Ralado (kg)', cost: 72.00, stock: 20.0, unit: 'KG', category: 'Laticínios' } })
    await prisma.supply.create({ data: { name: 'Requeijão Cremoso Catupiry Original (Bisnaga 1.5kg)', cost: 48.00, stock: 35.0, unit: 'UN', category: 'Laticínios' } })
    const supCalabresa = await prisma.supply.create({ data: { name: 'Linguiça Calabresa Defumada Nobre (kg)', cost: 26.90, stock: 65.0, unit: 'KG', category: 'Carnes' } })
    const supBacon = await prisma.supply.create({ data: { name: 'Bacon em Cubos Defumado Especial (kg)', cost: 34.00, stock: 45.0, unit: 'KG', category: 'Carnes' } })
    const supBlendBovino = await prisma.supply.create({ data: { name: 'Blend Bovino Angus 180g (Hambúrguer)', cost: 6.80, stock: 240.0, unit: 'UN', category: 'Carnes' } })
    const supPaoBrioche = await prisma.supply.create({ data: { name: 'Pão de Brioche Artesanal Selado', cost: 1.90, stock: 300.0, unit: 'UN', category: 'Panificação' } })
    const supCheddar = await prisma.supply.create({ data: { name: 'Queijo Cheddar Fatiado Especial (kg)', cost: 44.00, stock: 30.0, unit: 'KG', category: 'Laticínios' } })
    await prisma.supply.create({ data: { name: 'Molho de Tomate Pelati San Marzano (Lata 2.5kg)', cost: 28.50, stock: 40.0, unit: 'UN', category: 'Conservas' } })
    const supBatata = await prisma.supply.create({ data: { name: 'Batata Palito Pré-frita 9mm (Pacote 2.5kg)', cost: 22.00, stock: 60.0, unit: 'UN', category: 'Congelados' } })
    await prisma.supply.create({ data: { name: 'Óleo de Fritura Especial (Balde 18L)', cost: 110.00, stock: 8.0, unit: 'UN', category: 'Óleos' } })
    const supEmbalagemPizza = await prisma.supply.create({ data: { name: 'Caixa de Pizza Oitavada Térmica', cost: 2.80, stock: 500.0, unit: 'UN', category: 'Embalagens' } })
    const supEmbalagemBurger = await prisma.supply.create({ data: { name: 'Caixa Kraft Burger Térmica', cost: 0.95, stock: 800.0, unit: 'UN', category: 'Embalagens' } })

    // 9. Grupos de Adicionais & Opcionais (Aba 4)
    console.log('✨ Criando Grupos de Adicionais & Opcionais (Aba 4)...')
    const grpBordas = await prisma.complementGroup.create({
        data: {
            name: 'Bordas Recheadas para Pizza',
            min_quantity: 0,
            max_quantity: 1,
            free_quantity: 0,
            options: {
                create: [
                    { name: 'Borda Recheada Catupiry Original', price: 9.90 },
                    { name: 'Borda Recheada Cheddar Cremoso', price: 8.90 },
                    { name: 'Borda Recheada Chocolate ao Leite Nestlé', price: 11.90 },
                    { name: 'Borda Vulcão Quatro Queijos', price: 14.50 },
                ]
            }
        },
        include: { options: true }
    })

    const grpPontoCarne = await prisma.complementGroup.create({
        data: {
            name: 'Ponto da Carne',
            min_quantity: 1,
            max_quantity: 1,
            free_quantity: 1,
            options: {
                create: [
                    { name: 'Ao Ponto pra Menos (Vermelho no centro)', price: 0.00 },
                    { name: 'Ao Ponto da Casa (Suculento e rosado)', price: 0.00 },
                    { name: 'Bem Passado', price: 0.00 },
                ]
            }
        },
        include: { options: true }
    })

    const grpAdicionaisBurger = await prisma.complementGroup.create({
        data: {
            name: 'Adicionais do Burger',
            min_quantity: 0,
            max_quantity: 5,
            free_quantity: 0,
            options: {
                create: [
                    { name: 'Bacon Crocante Extra', price: 5.50 },
                    { name: 'Queijo Cheddar Inglês Extra', price: 4.50 },
                    { name: 'Ovo Caipira Frito na Manteiga', price: 3.50 },
                    { name: 'Cebola Caramelizada no Shoyu', price: 4.00 },
                    { name: 'Hambúrguer Angus 180g Extra', price: 13.90 },
                ]
            }
        },
        include: { options: true }
    })

    const grpMolhos = await prisma.complementGroup.create({
        data: {
            name: 'Molhos Especiais da Casa',
            min_quantity: 0,
            max_quantity: 3,
            free_quantity: 1,
            options: {
                create: [
                    { name: 'Maionese Verde Artesanal da Casa', price: 3.50 },
                    { name: 'Molho Barbecue Defumado com Jack Daniels', price: 4.00 },
                    { name: 'Geléia de Pimenta Biquinho Suave', price: 4.50 },
                    { name: 'Maionese de Alho Confitado', price: 3.50 },
                ]
            }
        },
        include: { options: true }
    })

    // 10. Produtos e Fichas Técnicas (Abas 1 e 3)
    console.log('🍕 Criando Produtos & Fichas Técnicas de CMV (Abas 1 e 3)...')
    let displaySeq = 100

    const pzCalabresa = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Pizza Calabresa Nobre Especial',
            price: 64.90,
            cost: 16.50,
            description: 'Molho San Marzano, muçarela especial, calabresa fatiada crocante, cebola roxa e orégano chileno.',
            category_id: catPizzas.id,
            subcategory_id: subPizzasTrad.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supMucarela.id, quantity: 0.35 },
                    { supply_id: supCalabresa.id, quantity: 0.30 },
                    { supply_id: supEmbalagemPizza.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpBordas.id, order: 0 }]
            }
        }
    })

    const pz4Queijos = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Pizza Quatro Queijos da Serra',
            price: 74.90,
            cost: 21.80,
            description: 'Muçarela especial, gorgonzola D.O.P., provolone defumado, parmesão curado e Catupiry original.',
            category_id: catPizzas.id,
            subcategory_id: subPizzasTrad.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supMucarela.id, quantity: 0.25 },
                    { supply_id: supGorgonzola.id, quantity: 0.10 },
                    { supply_id: supParmesao.id, quantity: 0.08 },
                    { supply_id: supEmbalagemPizza.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpBordas.id, order: 0 }]
            }
        }
    })

    const pzMargherita = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Pizza Margherita Bella Italia',
            price: 68.90,
            cost: 17.20,
            description: 'Molho San Marzano, fatias de muçarela de búfala, rodelas de tomate fresco, pesto de manjericão e azeite extravirgem.',
            category_id: catPizzas.id,
            subcategory_id: subPizzasTrad.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supMucarela.id, quantity: 0.35 },
                    { supply_id: supEmbalagemPizza.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpBordas.id, order: 0 }]
            }
        }
    })

    const pzFrangoCatupiry = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Pizza Frango Desfiado com Catupiry',
            price: 69.90,
            cost: 18.40,
            description: 'Peito de frango desfiado temperado com ervas finas, muçarela, generosas tiras de Catupiry original e milho verde.',
            category_id: catPizzas.id,
            subcategory_id: subPizzasTrad.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supMucarela.id, quantity: 0.25 },
                    { supply_id: supEmbalagemPizza.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpBordas.id, order: 0 }]
            }
        }
    })

    const pzPepperoni = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Pizza Pepperoni Supreme',
            price: 78.90,
            cost: 23.50,
            description: 'Generosa camada de pepperoni artesanal levemente picante, muçarela derretida e azeitonas pretas.',
            category_id: catPizzas.id,
            subcategory_id: subPizzasEsp.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supMucarela.id, quantity: 0.30 },
                    { supply_id: supEmbalagemPizza.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpBordas.id, order: 0 }]
            }
        }
    })

    const bgClassic = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Bella Classic Burger',
            price: 36.90,
            cost: 11.20,
            description: 'Pão brioche artesanal selado na manteiga, blend Angus 180g, queijo cheddar inglês, alface americana, tomate fresco e maionese da casa.',
            category_id: catBurgers.id,
            subcategory_id: subBurgers.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supPaoBrioche.id, quantity: 1.0 },
                    { supply_id: supBlendBovino.id, quantity: 1.0 },
                    { supply_id: supCheddar.id, quantity: 0.06 },
                    { supply_id: supEmbalagemBurger.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [
                    { group_id: grpPontoCarne.id, order: 0 },
                    { group_id: grpAdicionaisBurger.id, order: 1 },
                    { group_id: grpMolhos.id, order: 2 },
                ]
            }
        }
    })

    const bgDoubleBacon = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Double Cheddar Bacon Monster',
            price: 46.90,
            cost: 16.80,
            description: 'Pão brioche, 2x blends Angus 180g (360g de carne), quadruplo cheddar cremoso derretido, fatias crocantes de bacon e barbecue defumado.',
            category_id: catBurgers.id,
            subcategory_id: subBurgers.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: true,
            compositions: {
                create: [
                    { supply_id: supPaoBrioche.id, quantity: 1.0 },
                    { supply_id: supBlendBovino.id, quantity: 2.0 },
                    { supply_id: supCheddar.id, quantity: 0.12 },
                    { supply_id: supBacon.id, quantity: 0.08 },
                    { supply_id: supEmbalagemBurger.id, quantity: 1.0 },
                ]
            },
            complementGroups: {
                create: [
                    { group_id: grpPontoCarne.id, order: 0 },
                    { group_id: grpAdicionaisBurger.id, order: 1 },
                    { group_id: grpMolhos.id, order: 2 },
                ]
            }
        }
    })

    const porcaoBatata = await prisma.product.create({
        data: {
            display_id: displaySeq++,
            name: 'Batata Rústica Especial com Cheddar e Bacon',
            price: 38.90,
            cost: 9.80,
            description: '500g de batata palito crocante coberta com calda de cheddar derretido e farofa de bacon defumado.',
            category_id: catEntradas.id,
            measureUnit: MeasureUnit.UNITARY,
            is_composite: true,
            is_priority: false,
            compositions: {
                create: [
                    { supply_id: supBatata.id, quantity: 0.20 },
                    { supply_id: supBacon.id, quantity: 0.06 },
                ]
            },
            complementGroups: {
                create: [{ group_id: grpMolhos.id, order: 0 }]
            }
        }
    })

    const refriCoca = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Coca-Cola Original Lata 350ml', price: 7.50, cost: 2.80, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })
    const refriCocaZero = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Coca-Cola Sem Açúcar 350ml', price: 7.50, cost: 2.80, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })
    const refriGuarana = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Guaraná Antarctica Lata 350ml', price: 7.00, cost: 2.60, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })
    const cervejaHeineken = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Cerveja Heineken Long Neck 330ml', price: 12.90, cost: 4.90, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })
    const sucoLaranja = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Suco de Laranja Natural 400ml', price: 11.50, cost: 3.20, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })
    const aguaMineral = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Água Mineral sem Gás 500ml', price: 5.00, cost: 1.20, category_id: catBebidas.id, measureUnit: MeasureUnit.UNITARY } })

    const petitGateau = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Petit Gâteau Belga com Sorvete de Creme', price: 26.90, cost: 7.50, category_id: catSobremesas.id, measureUnit: MeasureUnit.UNITARY } })
    const pudimLeite = await prisma.product.create({ data: { display_id: displaySeq++, name: 'Pudim de Leite Condensado da Vovó', price: 16.90, cost: 4.20, category_id: catSobremesas.id, measureUnit: MeasureUnit.UNITARY } })

    await prisma.productPrintDepartment.createMany({
        data: [
            { product_id: pzCalabresa.id, print_department_id: depForno.id },
            { product_id: pz4Queijos.id, print_department_id: depForno.id },
            { product_id: pzMargherita.id, print_department_id: depForno.id },
            { product_id: pzFrangoCatupiry.id, print_department_id: depForno.id },
            { product_id: pzPepperoni.id, print_department_id: depForno.id },
            { product_id: bgClassic.id, print_department_id: depCozinha.id },
            { product_id: bgDoubleBacon.id, print_department_id: depCozinha.id },
            { product_id: porcaoBatata.id, print_department_id: depCozinha.id },
            { product_id: refriCoca.id, print_department_id: depBar.id },
            { product_id: refriCocaZero.id, print_department_id: depBar.id },
            { product_id: refriGuarana.id, print_department_id: depBar.id },
            { product_id: cervejaHeineken.id, print_department_id: depBar.id },
            { product_id: sucoLaranja.id, print_department_id: depBar.id },
            { product_id: aguaMineral.id, print_department_id: depBar.id },
            { product_id: petitGateau.id, print_department_id: depCozinha.id },
            { product_id: pudimLeite.id, print_department_id: depCozinha.id },
        ]
    })

    // 11. Criar Clientes Frequentes
    console.log('👥 Criando Clientes Frequentes do Restaurante & Delivery...')
    const clientesNomes = [
        { name: 'Ricardo Mendes', phone: '11991234567', street: 'Rua Bela Cintra', number: '450', neigh: 'Consolação' },
        { name: 'Beatriz Vasconcelos', phone: '11992345678', street: 'Alameda Santos', number: '1800', neigh: 'Cerqueira César' },
        { name: 'Eduardo Silveira', phone: '11993456789', street: 'Rua Augusta', number: '2200', neigh: 'Jardins' },
        { name: 'Juliana Paes', phone: '11994567890', street: 'Rua Oscar Freire', number: '920', neigh: 'Pinheiros' },
        { name: 'Fernando Rocha', phone: '11995678901', street: 'Av. Brigadeiro Luís Antônio', number: '3100', neigh: 'Jardim Paulista' },
        { name: 'Camila Pitanga', phone: '11996789012', street: 'Rua Haddock Lobo', number: '1307', neigh: 'Cerqueira César' },
        { name: 'Rodrigo Faro', phone: '11997890123', street: 'Av. Rebouças', number: '1500', neigh: 'Pinheiros' },
        { name: 'Mariana Ximenes', phone: '11998901234', street: 'Rua Pamplona', number: '850', neigh: 'Jardim Paulista' },
        { name: 'Gabriel Medina', phone: '11999012345', street: 'Rua da Consolação', number: '2800', neigh: 'Cerqueira César' },
        { name: 'Larissa Manoela', phone: '11990123456', street: 'Alameda Lorena', number: '1420', neigh: 'Jardins' },
    ]

    const clientesCriados = []
    for (const c of clientesNomes) {
        const cl = await prisma.client.create({
            data: {
                name: c.name,
                phone: c.phone,
                addresses: {
                    create: {
                        street: c.street,
                        number: c.number,
                        neighborhood: c.neigh,
                        city: 'São Paulo',
                        state: 'SP',
                        zipcode: '01400-000',
                        is_main: true
                    }
                }
            }
        })
        clientesCriados.push(cl)
    }

    // 12. Simulação de 60 Dias de Operação Completa (Caixas, Vendas, Despesas, Vales)
    console.log('⏳ Gerando Histórico Completo de 60 Dias (120 Sessões de Caixa, ~1.500 Vendas e Despesas)...')

    const produtosVenda = [
        { p: pzCalabresa, qty: 1 },
        { p: pz4Queijos, qty: 1 },
        { p: pzMargherita, qty: 1 },
        { p: pzFrangoCatupiry, qty: 1 },
        { p: pzPepperoni, qty: 1 },
        { p: bgClassic, qty: 1 },
        { p: bgDoubleBacon, qty: 1 },
        { p: porcaoBatata, qty: 1 },
        { p: refriCoca, qty: 2 },
        { p: refriGuarana, qty: 2 },
        { p: cervejaHeineken, qty: 2 },
        { p: sucoLaranja, qty: 1 },
        { p: petitGateau, qty: 1 },
        { p: pudimLeite, qty: 1 },
    ]

    const formasPagamentoList = [
        { method: 'CREDIT', name: 'Cartão de Crédito', acc: accBB },
        { method: 'CREDIT', name: 'Cartão de Crédito', acc: accBB },
        { method: 'DEBIT', name: 'Cartão de Débito', acc: accBB },
        { method: 'PIX', name: 'Pix', acc: accBB },
        { method: 'PIX', name: 'Pix', acc: accBB },
        { method: 'CASH', name: 'Dinheiro', acc: accCofre },
    ]

    const agora = new Date()

    for (let diasAtras = 59; diasAtras >= 0; diasAtras--) {
        const dataDia = new Date(agora.getTime() - diasAtras * 24 * 60 * 60 * 1000)
        
        // Turno 1: Almoço (11:30 às 15:30)
        const dataAberturaAlmoco = new Date(dataDia)
        dataAberturaAlmoco.setHours(11, 30, 0, 0)
        const dataFechamentoAlmoco = new Date(dataDia)
        dataFechamentoAlmoco.setHours(15, 30, 0, 0)

        const sessaoAlmoco = await prisma.cashierSession.create({
            data: {
                user_id: cashierUser.id,
                period: 'Almoço',
                status: 'CLOSED',
                initial_balance: 200.00,
                opened_at: dataAberturaAlmoco,
                closed_at: dataFechamentoAlmoco,
                created_at: dataAberturaAlmoco
            }
        })

        // Turno 2: Jantar (18:00 às 23:45)
        const dataAberturaJantar = new Date(dataDia)
        dataAberturaJantar.setHours(18, 0, 0, 0)
        const dataFechamentoJantar = new Date(dataDia)
        dataFechamentoJantar.setHours(23, 45, 0, 0)

        const sessaoJantar = await prisma.cashierSession.create({
            data: {
                user_id: cashierUser.id,
                period: 'Jantar',
                status: 'CLOSED',
                initial_balance: 200.00,
                opened_at: dataAberturaJantar,
                closed_at: dataFechamentoJantar,
                created_at: dataAberturaJantar
            }
        })

        const sessoes = [
            { sessao: sessaoAlmoco, qtdVendas: 10 + (diasAtras % 6), baseDate: dataAberturaAlmoco },
            { sessao: sessaoJantar, qtdVendas: 18 + (diasAtras % 10), baseDate: dataAberturaJantar },
        ]

        for (const s of sessoes) {
            for (let v = 0; v < s.qtdVendas; v++) {
                const dataVenda = new Date(s.baseDate.getTime() + (v * 12 + 5) * 60 * 1000)
                const client = clientesCriados[(diasAtras + v) % clientesCriados.length]
                const forma = formasPagamentoList[(v + diasAtras) % formasPagamentoList.length]
                const origem = (v % 3 === 0) ? 'Delivery' : (v % 3 === 1 ? 'Mesa' : 'Balcao')

                const item1 = produtosVenda[(v * 3) % produtosVenda.length]
                const item2 = produtosVenda[(v * 3 + 1) % produtosVenda.length]
                const item3 = produtosVenda[(v * 3 + 2) % produtosVenda.length]
                const itensEscolhidos = [item1, item2, item3]

                const subtotal = itensEscolhidos.reduce((acc, it) => acc + it.p.price * it.qty, 0)
                const totalVenda = subtotal + (origem === 'Delivery' ? 7.50 : 0)

                // 1. Criar Sale
                const sale = await prisma.sale.create({
                    data: {
                        cashier_session_id: s.sessao.id,
                        total_amount: totalVenda,
                        status: 'COMPLETED',
                        created_at: dataVenda,
                        items: {
                            create: itensEscolhidos.map(it => ({
                                product_id: it.p.id,
                                quantity: it.qty,
                                unit_price: it.p.price
                            }))
                        }
                    }
                })

                // 2. Criar CashierEntry
                await prisma.cashierEntry.create({
                    data: {
                        cashier_session_id: s.sessao.id,
                        origin: origem,
                        payment_method: forma.name,
                        amount: totalVenda,
                        type: 'SALE',
                        identification: origem === 'Mesa' ? 'MESA ' + ((v % 15) + 1) : (origem === 'Delivery' ? 'DELIVERY #' + sale.id.slice(0, 5) : 'BALCÃO'),
                        client_id: client.id,
                        created_at: dataVenda
                    }
                })

                // 3. Criar Transação Financeira Confirmada
                await prisma.transaction.create({
                    data: {
                        operation: 'in',
                        amount: totalVenda,
                        account_id: forma.acc.id,
                        sector_id: secVendas.id,
                        description: 'Venda #' + sale.id.slice(0, 6) + ' (' + origem + ' - ' + forma.name + ')',
                        confirmed: true,
                        checked: true,
                        payment_method: forma.method,
                        cashier_session_id: s.sessao.id,
                        data_emissao: dataVenda,
                        data_vencimento: dataVenda,
                        created_at: dataVenda
                    }
                })
            }

            if (s.sessao.period === 'Jantar') {
                const dataSangria = new Date(s.baseDate.getTime() + 180 * 60 * 1000)
                await prisma.cashierEntry.create({
                    data: {
                        cashier_session_id: s.sessao.id,
                        origin: 'Gaveta',
                        payment_method: 'Dinheiro',
                        amount: 500.00,
                        is_withdrawal: true,
                        type: 'WITHDRAWAL',
                        identification: 'Sangria de Segurança para o Cofre',
                        created_at: dataSangria
                    }
                })
            }
        }

        // Compras de fornecedores semanais
        if (diasAtras % 7 === 0) {
            const dataCompra = new Date(dataDia)
            dataCompra.setHours(9, 0, 0, 0)

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 2850.00,
                    account_id: accBB.id,
                    sector_id: secInsumos.id,
                    supplier_id: supLaticinios.id,
                    description: 'Compra Semanal de Laticínios e Queijos Especiais',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataCompra,
                    data_vencimento: dataCompra,
                    created_at: dataCompra
                }
            })

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 3400.00,
                    account_id: accBB.id,
                    sector_id: secInsumos.id,
                    supplier_id: supCarnes.id,
                    description: 'Compra Semanal de Carnes Angus, Calabresa e Bacon',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataCompra,
                    data_vencimento: dataCompra,
                    created_at: dataCompra
                }
            })

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 1250.00,
                    account_id: accBB.id,
                    sector_id: secBebidas.id,
                    supplier_id: supBebidas.id,
                    description: 'Reposição Semanal de Refrigerantes, Cervejas e Sucos',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataCompra,
                    data_vencimento: dataCompra,
                    created_at: dataCompra
                }
            })
        }

        // Despesas Fixas Mensais
        if (diasAtras === 30 || diasAtras === 0) {
            const dataDespesa = new Date(dataDia)
            dataDespesa.setHours(10, 0, 0, 0)

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 6500.00,
                    account_id: accBB.id,
                    sector_id: secOperacional.id,
                    description: 'Aluguel do Ponto Comercial Jardins',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataDespesa,
                    data_vencimento: dataDespesa,
                    created_at: dataDespesa
                }
            })

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 2380.00,
                    account_id: accBB.id,
                    sector_id: secOperacional.id,
                    description: 'Energia Elétrica Comercial (Enel SP)',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataDespesa,
                    data_vencimento: dataDespesa,
                    created_at: dataDespesa
                }
            })

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 1750.00,
                    account_id: accBB.id,
                    sector_id: secOperacional.id,
                    description: 'Gás GLP Industrial (Ultragaz)',
                    confirmed: true,
                    checked: true,
                    payment_method: 'boleto',
                    data_emissao: dataDespesa,
                    data_vencimento: dataDespesa,
                    created_at: dataDespesa
                }
            })
        }

        // Vales de Funcionários quinzenais
        if (diasAtras % 15 === 0) {
            const dataVale = new Date(dataDia)
            dataVale.setHours(16, 0, 0, 0)

            await prisma.payrollEntry.create({
                data: {
                    employee_id: empPizzaiolo.id,
                    description: 'Adiantamento Quinzenal (Vale)',
                    amount: 1000.00,
                    type: PayrollType.VALE,
                    referenceDate: dataVale,
                    status: 'PAID'
                }
            })

            await prisma.payrollEntry.create({
                data: {
                    employee_id: empGarcom.id,
                    description: 'Adiantamento Quinzenal (Vale)',
                    amount: 600.00,
                    type: PayrollType.VALE,
                    referenceDate: dataVale,
                    status: 'PAID'
                }
            })

            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: 1600.00,
                    account_id: accBB.id,
                    sector_id: secPessoal.id,
                    description: 'Pagamento de Vales da Equipe (Carlos e Marcos)',
                    confirmed: true,
                    checked: true,
                    payment_method: 'pix',
                    data_emissao: dataVale,
                    data_vencimento: dataVale,
                    created_at: dataVale
                }
            })
        }
    }

    console.log('✅ POPULAÇÃO CONCLUÍDA COM SUCESSO!')
    console.log('📊 Banco db_restaurante agora possui 60 dias de movimentações, vendas, fechamentos, DRE e receitas completas!')
}

main()
    .catch((e) => {
        console.error('❌ Erro durante população:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
