const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const users = await prisma.user.count()
    const clients = await prisma.client.count()
    const accounts = await prisma.account.count()
    const transactions = await prisma.transaction.count()
    const sectors = await prisma.sector.count()
    console.log('Counts:');
    console.log('  Users:', users);
    console.log('  Clients:', clients);
    console.log('  Accounts:', accounts);
    console.log('  Sectors:', sectors);
    console.log('  Transactions:', transactions);
  } catch (err) {
    console.error('Error querying models:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
