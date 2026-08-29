import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

export interface OnboardingData {
    adminPassword?: string
    masterUser?: {
        name: string
        email: string
        password?: string
    }
    enabledModules?: string[] // e.g. ['items', 'service', 'finance', 'hr', 'settings']
    systemConfig?: {
        merchandise_module?: boolean
        financial_module?: boolean
        treatments_module?: boolean
        cashier_module?: boolean
        hr_module?: boolean
        financial_management_profile?: string
        blind_cashier_closure?: boolean
    }
}

export async function runTenantOnboarding(dbUrl: string, data: OnboardingData) {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl
            }
        }
    })

    try {
        console.log(`[Onboarding] Iniciando configuração estruturada para o tenant...`)

        // 1. Garantir que o usuário Suporte (admin@admin.com) possui acesso a TODOS os módulos existentes
        const allModules = await prisma.module.findMany()
        const supportAdmin = await prisma.user.findUnique({
            where: { email: 'admin@admin.com' }
        })

        if (supportAdmin) {
            for (const mod of allModules) {
                await prisma.userModule.upsert({
                    where: {
                        user_id_module_id: {
                            user_id: supportAdmin.id,
                            module_id: mod.id
                        }
                    },
                    update: {},
                    create: {
                        user_id: supportAdmin.id,
                        module_id: mod.id
                    }
                })
            }
            console.log(`[Onboarding] Permissões globais do Suporte (admin@admin.com) vinculadas.`)
        }

        // 2. Se foi enviado um usuário Master da empresa (dono/gerente)
        if (data.masterUser && data.masterUser.email) {
            const masterPass = data.masterUser.password || '123456'
            const password_hash = await hash(masterPass, 6)
            
            const clientUser = await prisma.user.upsert({
                where: { email: data.masterUser.email.toLowerCase().trim() },
                update: {
                    name: data.masterUser.name,
                    password_hash
                },
                create: {
                    name: data.masterUser.name,
                    email: data.masterUser.email.toLowerCase().trim(),
                    password_hash,
                    role: 'ADMIN'
                }
            })

            // Vincular aos módulos habilitados (ou todos se não especificado)
            const targetModules = data.enabledModules && data.enabledModules.length > 0
                ? allModules.filter(m => data.enabledModules!.includes(m.slug))
                : allModules

            for (const mod of targetModules) {
                await prisma.userModule.upsert({
                    where: {
                        user_id_module_id: {
                            user_id: clientUser.id,
                            module_id: mod.id
                        }
                    },
                    update: {},
                    create: {
                        user_id: clientUser.id,
                        module_id: mod.id
                    }
                })
            }
            console.log(`[Onboarding] Usuário Master (${clientUser.email}) criado com ${targetModules.length} módulos.`)
        }

        // 3. Atualizar SystemConfig com flags de módulos e parâmetros operacionais
        const existingConfig = await prisma.systemConfig.findFirst()
        const isCashierEnabled = data.systemConfig?.cashier_module ?? true
        const isFinanceEnabled = data.systemConfig?.financial_module ?? true
        const isTreatmentsEnabled = data.systemConfig?.treatments_module ?? true
        const isMerchandiseEnabled = data.systemConfig?.merchandise_module ?? true
        const isHrEnabled = data.systemConfig?.hr_module ?? true

        if (existingConfig) {
            await prisma.systemConfig.update({
                where: { id: existingConfig.id },
                data: {
                    cashier_module: isCashierEnabled,
                    financial_module: isFinanceEnabled,
                    treatments_module: isTreatmentsEnabled,
                    merchandise_module: isMerchandiseEnabled,
                    hr_module: isHrEnabled,
                    financial_management_profile: data.systemConfig?.financial_management_profile || 'ANALYTICAL',
                    blind_cashier_closure: data.systemConfig?.blind_cashier_closure ?? false
                }
            })
            console.log(`[Onboarding] SystemConfig atualizado com os módulos contratados.`)
        }

        // 4. Criar Caixa Central se não existir
        let caixaCentral = await prisma.account.findFirst({
            where: { name: 'Caixa Central' }
        })

        if (!caixaCentral) {
            caixaCentral = await prisma.account.create({
                data: {
                    name: 'Caixa Central',
                    description: 'Conta principal para movimentações em dinheiro e gaveta do PDV',
                    balance: 0,
                    is_transit: false
                }
            })
            console.log(`[Onboarding] Conta Caixa Central criada.`)
        }

        // 5. Criar Formas de Pagamento Padrão e Identificadores
        const defaultPayments = [
            { name: 'Dinheiro', in_sight: true, installment_limit: 1, account_id: caixaCentral.id, sefaz_tPag: '01' },
            { name: 'PIX', in_sight: true, installment_limit: 1, account_id: null, sefaz_tPag: '17' },
            { name: 'Cartão de Débito', in_sight: true, installment_limit: 1, account_id: null, sefaz_tPag: '04' },
            { name: 'Cartão de Crédito', in_sight: false, installment_limit: 12, account_id: null, sefaz_tPag: '03' },
        ]

        for (const p of defaultPayments) {
            let payment = await prisma.payment.findFirst({
                where: { name: p.name }
            })
            if (!payment) {
                payment = await prisma.payment.create({
                    data: {
                        name: p.name,
                        in_sight: p.in_sight,
                        installment_limit: p.installment_limit,
                        account_id: p.account_id,
                        sefaz_tPag: p.sefaz_tPag,
                        active: true,
                        active_for_in: true,
                        active_for_out: true
                    }
                })
            }

            const identifier = await prisma.paymentIdentifier.findFirst({
                where: { name: p.name }
            })
            if (!identifier) {
                await prisma.paymentIdentifier.create({
                    data: {
                        name: p.name,
                        payment_method_id: payment.id,
                        active: true,
                        is_correntista_debt: false,
                        is_stock_evasion: false
                    }
                })
            }
        }
        console.log(`[Onboarding] Formas de Pagamento e Identificadores criados.`)

        // 6. Criar Departamentos de Impressão Padrão
        const defaultPrintDepartments = ['Caixa', 'Cozinha', 'Bar']
        for (const depName of defaultPrintDepartments) {
            const existingDep = await prisma.printDepartment.findUnique({
                where: { name: depName }
            })
            if (!existingDep) {
                await prisma.printDepartment.create({
                    data: { name: depName }
                })
            }
        }

        // 7. Criar Categorias de Produto Padrão
        const defaultCategories = ['Geral', 'Bebidas', 'Alimentos', 'Sobremesas']
        for (const catName of defaultCategories) {
            const existingCat = await prisma.category.findUnique({
                where: { name: catName }
            })
            if (!existingCat) {
                await prisma.category.create({
                    data: { name: catName }
                })
            }
        }

        // 8. Criar Setores Financeiros Padrão
        const defaultSectors = [
            { name: 'Vendas e Receitas', type: 'in' },
            { name: 'Fornecedores e Mercadorias', type: 'out' },
            { name: 'Despesas Operacionais', type: 'out' },
            { name: 'Folha de Pagamento', type: 'out' }
        ]
        for (const sec of defaultSectors) {
            const existingSec = await prisma.sector.findFirst({
                where: { name: sec.name }
            })
            if (!existingSec) {
                await prisma.sector.create({
                    data: {
                        name: sec.name,
                        type: sec.type
                    }
                })
            }
        }

        console.log(`[Onboarding] ? Onboarding dinâmico concluído com sucesso para o banco!`)
    } finally {
        await prisma.$disconnect()
    }
}
