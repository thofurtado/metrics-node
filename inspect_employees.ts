
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    const employees = await prisma.employee.findMany({
        select: {
            name: true,
            isRegistered: true,
            hasCestaBasica: true
        }
    })

    fs.writeFileSync('employees_list.json', JSON.stringify(employees, null, 2))
    console.log("Data written to employees_list.json")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
