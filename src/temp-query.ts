import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const employees = await prisma.employee.findMany({ select: { id: true, name: true, pin: true } })
    console.log(employees)
}

main().finally(() => prisma.$disconnect())
