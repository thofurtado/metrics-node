import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const defaultPassword = await hash('123456', 6)
    const result = await prisma.user.updateMany({
        data: {
            password_hash: defaultPassword
        }
    })
    console.log(`Todos os ${result.count} usuários tiveram suas senhas resetadas para: 123456`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
