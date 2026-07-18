import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
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

  console.log('✅ Seed de módulos e usuário admin concluído com sucesso!')
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
