import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de Integração (Pagamentos e Caixa)...')

  // 1. Identificadores Base (O coração da inteligência)
  const identifiers = [
    { name: 'Dinheiro Físico', is_correntista_debt: false, is_stock_evasion: false },
    { name: 'Pix', is_correntista_debt: false, is_stock_evasion: false },
    { name: 'Mastercard', is_correntista_debt: false, is_stock_evasion: false },
    { name: 'Visa', is_correntista_debt: false, is_stock_evasion: false },
    { name: 'Elo', is_correntista_debt: false, is_stock_evasion: false },
    { name: 'Permuta', is_correntista_debt: true, is_stock_evasion: false },
    { name: 'Funcionário', is_correntista_debt: true, is_stock_evasion: false },
    { name: 'Pró-labore', is_correntista_debt: false, is_stock_evasion: true },
    { name: 'Cortesia', is_correntista_debt: false, is_stock_evasion: true },
  ]

  for (const id of identifiers) {
    await prisma.paymentIdentifier.upsert({
      where: { name: id.name },
      update: {},
      create: id,
    })
  }

  // 2. Condições Base
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

  // 3. Formas de Pagamento Base (O mapeamento IN e OUT)
  const payments = [
    { name: 'Dinheiro', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: true },
    { name: 'Pix', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: true },
    { name: 'Cartão de Crédito', installment_limit: 12, in_sight: false, active_for_in: true, active_for_out: false },
    { name: 'Cartão de Débito', installment_limit: 1, in_sight: true, active_for_in: true, active_for_out: false },
    { name: 'Boleto Bancário', installment_limit: 1, in_sight: false, active_for_in: true, active_for_out: true },
    { name: 'A Prazo (Correntista/Evasão)', installment_limit: 1, in_sight: false, active_for_in: true, active_for_out: false },
  ]

  for (const pay of payments) {
    // Busca se já existe algo parecido
    const exists = await prisma.payment.findFirst({ where: { name: pay.name } })
    if (!exists) {
      await prisma.payment.create({ data: pay })
    }
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
