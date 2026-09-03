import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed padrão...')
  const modulesToSeed = [
    { name: 'Itens', slug: 'items', description: 'Permite gerenciar produtos, serviços e estoques.' },
    { name: 'Atendimento', slug: 'service', description: 'Acesso completo às telas de tratamento e ordem de serviço.' },
    { name: 'Financeiro', slug: 'finance', description: 'Controle de contas, fluxo de caixa e relatórios financeiros.' },
    { name: 'RH', slug: 'hr', description: 'Gestão de funcionários, folha de pagamento e pontos.' },
    { name: 'Configurações', slug: 'settings', description: 'Acesso ao painel administrativo e controle de permissões globais.' }
  ]

  for (const mod of modulesToSeed) {
    await prisma.module.upsert({
      where: { slug: mod.slug },
      update: { name: mod.name, description: mod.description },
      create: { name: mod.name, slug: mod.slug, description: mod.description }
    })
  }

  // Criação do usuário admin padrão
  const adminEmail = 'admin@admin.com'
  const adminPassword = await hash('T0p1nf0r', 6)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: adminEmail,
      password_hash: adminPassword,
      role: 'ADMIN'
    }
  })

  // Criação da Conta Caixa Central
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
  }

  // Criação da Conta Transitória (Cartões)
  let existingTransit = await prisma.account.findFirst({
    where: { is_transit: true }
  })
  if (!existingTransit) {
    existingTransit = await prisma.account.create({
      data: {
        name: 'Conta de Liquidação (Cartões)',
        description: 'Conta transitória para valores aguardando compensação das maquininhas',
        balance: 0,
        is_transit: true
      }
    })
    console.log('✅ Conta Transitória criada com sucesso!')
  }

  // Criação da Configuração Padrão do Sistema (SystemConfig)
  const existingConfig = await prisma.systemConfig.findFirst()
  if (!existingConfig) {
    await prisma.systemConfig.create({
      data: {}
    })
    console.log('✅ Configuração padrão do sistema criada com sucesso!')
  }

  // Formas de Pagamento Padrão (Exatamente as 7 oficiais do padrão Katatau)
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
    let payment = await prisma.payment.findFirst({
      where: { name: { equals: p.name, mode: 'insensitive' } }
    })
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
    }
    createdPaymentMap.set(p.name, payment.id)
  }

  // Identificadores de Caixa & Estoque
  const defaultIdentifiers = [
    { name: 'Cortesia', parentPaymentName: 'Operacional (Evasão de Estoque)', is_stock_evasion: true, is_correntista_debt: false },
    { name: 'Pró-labore', parentPaymentName: 'Operacional (Evasão de Estoque)', is_stock_evasion: true, is_correntista_debt: false },
    { name: 'Funcionário', parentPaymentName: 'A Prazo (Correntista)', is_stock_evasion: false, is_correntista_debt: true },
    { name: 'Permuta', parentPaymentName: 'A Prazo (Correntista)', is_stock_evasion: false, is_correntista_debt: true }
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

  // Condições de Pagamento
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

  // Setores Padrão
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

  console.log('✅ Seed Katatau standard concluído com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
