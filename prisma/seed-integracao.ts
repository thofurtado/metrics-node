import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de Integração (Pagamentos e Caixa)...')

  // 1. Formas de Pagamento Base
  const payments = [
    { name: 'Dinheiro', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: true },
    { name: 'Pix', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: true },
    { name: 'Cartão de Crédito', installment_limit: 12, in_sight: false, active_for_in: true, active_for_out: false },
    { name: 'Cartão de Débito', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: false },
    { name: 'Boleto Bancário', installment_limit: 1, in_sight: false, active_for_in: true, active_for_out: true },
    { name: 'A Prazo (Correntista)', installment_limit: 1, in_sight: false, active_for_in: true, active_for_out: false },
    { name: 'Operacional (Evasão de Estoque)', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: false },
  ]

  const createdPayments: Record<string, string> = {}

  for (const pay of payments) {
    let exists = await prisma.payment.findFirst({ where: { name: pay.name } })
    if (!exists) {
      exists = await prisma.payment.create({ data: pay })
    }
    createdPayments[pay.name] = exists.id
  }

  // 2. Identificadores Base (Vinculados às Formas de Pagamento)
  const identifiers = [
    { name: 'Permuta', is_correntista_debt: true, is_stock_evasion: false, payment_method_id: createdPayments['A Prazo (Correntista)'] },
    { name: 'Funcionário', is_correntista_debt: true, is_stock_evasion: false, payment_method_id: createdPayments['A Prazo (Correntista)'] },
    { name: 'Pró-labore', is_correntista_debt: false, is_stock_evasion: true, payment_method_id: createdPayments['Operacional (Evasão de Estoque)'] },
    { name: 'Cortesia', is_correntista_debt: false, is_stock_evasion: true, payment_method_id: createdPayments['Operacional (Evasão de Estoque)'] },
  ]

  for (const id of identifiers) {
    await prisma.paymentIdentifier.upsert({
      where: { name: id.name },
      update: {
        payment_method_id: id.payment_method_id,
        is_correntista_debt: id.is_correntista_debt,
        is_stock_evasion: id.is_stock_evasion
      },
      create: id,
    })
  }

  // 3. Condições Base
  const conditions = [
    { name: 'À Vista', installments: 1 },
    { name: 'Parcelado 2x', installments: 2 },
    { name: 'Parcelado 3x', installments: 3 },
  ]

  for (const cond of conditions) {
    await prisma.paymentCondition.upsert({
      where: { name: cond.name },
      update: {},
      create: cond,
    })
  }

  console.log('Seed de Integração concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
