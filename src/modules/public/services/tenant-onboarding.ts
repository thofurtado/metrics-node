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

        // 4. Criar Caixa Central e Conta de Liquidação (Cartões) se não existirem
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

        let contaTransit = await prisma.account.findFirst({
            where: { is_transit: true }
        })

        if (!contaTransit) {
            contaTransit = await prisma.account.create({
                data: {
                    name: 'Conta de Liquidação (Cartões)',
                    description: 'Conta transitória para valores aguardando compensação das maquininhas',
                    balance: 0,
                    is_transit: true
                }
            })
            console.log(`[Onboarding] Conta de Liquidação (Cartões) criada.`)
        }

        // 5. Criar Formas de Pagamento Padrão (Exatamente as 7 oficiais do padrão Katatau)
        const defaultPayments = [
            { name: 'Dinheiro', in_sight: true, installment_limit: 1, account_id: caixaCentral.id, sefaz_tPag: '01', active_for_in: true, active_for_out: true },
            { name: 'Pix', in_sight: true, installment_limit: 1, account_id: null, sefaz_tPag: '17', active_for_in: true, active_for_out: true },
            { name: 'Cartão de Crédito', in_sight: false, installment_limit: 12, account_id: null, sefaz_tPag: '03', active_for_in: true, active_for_out: false },
            { name: 'Cartão de Débito', in_sight: true, installment_limit: 1, account_id: null, sefaz_tPag: '04', active_for_in: true, active_for_out: false },
            { name: 'Boleto Bancário', in_sight: false, installment_limit: 1, account_id: null, sefaz_tPag: '15', active_for_in: true, active_for_out: true },
            { name: 'A Prazo (Correntista)', in_sight: false, installment_limit: 1, account_id: null, sefaz_tPag: '99', active_for_in: true, active_for_out: false },
            { name: 'Operacional (Evasão de Estoque)', in_sight: true, installment_limit: 1, account_id: null, sefaz_tPag: '90', active_for_in: true, active_for_out: false },
        ]

        const createdPaymentMap = new Map<string, string>()

        for (const p of defaultPayments) {
            // Busca normalizada para não duplicar de forma alguma
            let payment = await prisma.payment.findFirst({
                where: {
                    name: { equals: p.name, mode: 'insensitive' }
                }
            })

            // Se for Pix, também checa se existe "PIX" em caixa alta
            if (!payment && p.name === 'Pix') {
                payment = await prisma.payment.findFirst({
                    where: { name: { in: ['PIX', 'pix', 'Pix'] } }
                })
            }

            if (!payment) {
                payment = await prisma.payment.create({
                    data: {
                        name: p.name,
                        in_sight: p.in_sight,
                        installment_limit: p.installment_limit,
                        account_id: p.account_id,
                        sefaz_tPag: p.sefaz_tPag,
                        active: true,
                        active_for_in: p.active_for_in,
                        active_for_out: p.active_for_out
                    }
                })
            } else {
                // Atualiza em conformidade para o nome canônico UTF-8 e parâmetros oficiais
                payment = await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        name: p.name,
                        in_sight: p.in_sight,
                        installment_limit: p.installment_limit,
                        account_id: payment.account_id || p.account_id,
                        sefaz_tPag: payment.sefaz_tPag || p.sefaz_tPag,
                        active: true,
                        active_for_in: p.active_for_in,
                        active_for_out: p.active_for_out
                    }
                })
            }

            createdPaymentMap.set(p.name, payment.id)
        }
        console.log(`[Onboarding] 7 Formas de Pagamento padrão criadas/atualizadas com sucesso.`)

        // 6. Criar Identificadores de Caixa & Estoque (Operações oficiais Katatau)
        const defaultIdentifiers = [
            {
                name: 'Cortesia',
                parentPaymentName: 'Operacional (Evasão de Estoque)',
                is_stock_evasion: true,
                is_correntista_debt: false
            },
            {
                name: 'Pró-labore',
                parentPaymentName: 'Operacional (Evasão de Estoque)',
                is_stock_evasion: true,
                is_correntista_debt: false
            },
            {
                name: 'Funcionário',
                parentPaymentName: 'A Prazo (Correntista)',
                is_stock_evasion: false,
                is_correntista_debt: true
            },
            {
                name: 'Permuta',
                parentPaymentName: 'A Prazo (Correntista)',
                is_stock_evasion: false,
                is_correntista_debt: true
            }
        ]

        for (const idDef of defaultIdentifiers) {
            const parentId = createdPaymentMap.get(idDef.parentPaymentName) || null

            await prisma.paymentIdentifier.upsert({
                where: { name: idDef.name },
                update: {
                    payment_method_id: parentId,
                    is_stock_evasion: idDef.is_stock_evasion,
                    is_correntista_debt: idDef.is_correntista_debt,
                    active: true
                },
                create: {
                    name: idDef.name,
                    payment_method_id: parentId,
                    is_stock_evasion: idDef.is_stock_evasion,
                    is_correntista_debt: idDef.is_correntista_debt,
                    active: true
                }
            })
        }

        // Remove identificadores duplicados antigos que tinham o mesmo nome da forma de pagamento
        try {
            await prisma.paymentIdentifier.deleteMany({
                where: {
                    name: { in: ['Dinheiro', 'Pix', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'] },
                    is_stock_evasion: false,
                    is_correntista_debt: false
                }
            })
        } catch (e) {}

        console.log(`[Onboarding] 4 Identificadores Operacionais de Caixa & Estoque vinculados.`)

        // 7. Criar Condições de Pagamento Padrão (À Vista, Parcelado 2x, Parcelado 3x)
        const defaultConditions = [
            { name: 'À Vista', installments: 1 },
            { name: 'Parcelado 2x', installments: 2 },
            { name: 'Parcelado 3x', installments: 3 },
        ]

        for (const cond of defaultConditions) {
            await prisma.paymentCondition.upsert({
                where: { name: cond.name },
                update: { installments: cond.installments, active: true },
                create: { name: cond.name, installments: cond.installments, active: true }
            })
        }
        console.log(`[Onboarding] Condições de Pagamento padrão criadas.`)

        // 8. Criar Departamentos de Impressão Padrão
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

        // 9. Criar Categorias de Produto Padrão
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

        // 10. Criar Setores Financeiros Padrão (Entradas e Saídas Oficiais)
        const defaultSectors = [
            { name: 'Caixa', type: 'in' },
            { name: 'Correntista', type: 'in' },
            { name: 'Vendas e Receitas', type: 'in' },
            { name: 'Despesas Operacionais', type: 'out' },
            { name: 'Fornecedores e Mercadorias', type: 'out' },
            { name: 'Folha de Pagamento', type: 'out' },
            { name: 'Insumos', type: 'out' },
            { name: 'Impostos', type: 'out' },
            { name: 'Fixas', type: 'out' },
            { name: 'Limpeza e Higiene', type: 'out' },
            { name: 'Embalagens', type: 'out' }
        ]

        for (const sec of defaultSectors) {
            const existingSec = await prisma.sector.findFirst({
                where: { name: { equals: sec.name, mode: 'insensitive' } }
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

        console.log(`[Onboarding] Setores financeiros padrão criados.`)
        console.log(`[Onboarding] ✅ Onboarding dinâmico concluído com sucesso para o banco!`)
    } finally {
        await prisma.$disconnect()
    }
}
