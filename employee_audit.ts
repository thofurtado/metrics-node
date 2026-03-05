
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    let output = ""
    const log = (msg: string) => {
        output += msg + "\n"
        console.log(msg)
    }

    log("Listing ALL employees and their statuses...")
    const employees = await prisma.employee.findMany({
        select: {
            id: true,
            name: true,
            pin: true,
            isRegistered: true,
            registrationType: true
        }
    })

    log(`Total employees found: ${employees.length}`)
    log(JSON.stringify(employees, null, 2))

    log("\nChecking for duplicate PINs (1234)...")
    const pin1234 = employees.filter(e => e.pin === '1234')
    log(`Found ${pin1234.length} employees with PIN 1234`)
    if (pin1234.length > 1) {
        log(JSON.stringify(pin1234, null, 2))
    }

    const teste = employees.find(e => e.name.toLowerCase().includes('teste'))
    if (teste) {
        log("\n--- DETAILED INFO FOR 'TESTE' ---")
        log(JSON.stringify(teste, null, 2))

        const today = new Date('2026-03-05T00:00:00Z')
        const tomorrow = new Date('2026-03-06T00:00:00Z')

        const todayClocks = await prisma.timeClock.findMany({
            where: {
                employee_id: teste.id,
                date: {
                    gte: today,
                    lt: tomorrow
                }
            }
        })
        log(`\nClocks for 2026-03-05: ${todayClocks.length}`)
        log(JSON.stringify(todayClocks, null, 2))
    }

    fs.writeFileSync('employee_audit.txt', output)
    log("Logged to employee_audit.txt")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
