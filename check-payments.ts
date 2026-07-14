import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const payments = await prisma.payment.findMany()
  console.log('PAYMENTS COUNT:', payments.length)
  console.log(JSON.stringify(payments, null, 2))
}
main()
