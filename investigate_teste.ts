
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    let output = ""
    const log = (msg: string) => {
        output += msg + "\n"
        console.log(msg)
    }

    log(`Current script execution time (UTC): ${new Date().toISOString()}`);
    const serverToday = new Date();
    serverToday.setHours(0, 0, 0, 0);
    log(`Server 'today' (setHours 0,0,0,0): ${serverToday.toISOString()}`);

    log("Searching for employee 'Teste'...")
    const employee = await prisma.employee.findFirst({
        where: {
            name: {
                contains: 'Teste',
                mode: 'insensitive'
            }
        }
    })

    if (!employee) {
        log("Employee 'Teste' not found")
        fs.writeFileSync('investigation_log.txt', output)
        return
    }

    log(`Found employee: ${employee.name} (ID: ${employee.id}, PIN: ${employee.pin})`)

    const todayStr = '2026-03-05'
    const today = new Date(todayStr)
    today.setHours(0, 0, 0, 0)

    log(`Searching for time clock on date: ${today.toISOString()}`)

    const timeClock = await prisma.timeClock.findFirst({
        where: {
            employee_id: employee.id,
            date: today
        }
    })

    if (timeClock) {
        log("Time Clock found for today:")
        log(JSON.stringify(timeClock, null, 2))
    } else {
        log("No Time Clock found for today in the database.")
    }

    // Check recent clocks
    const recentClocks = await prisma.timeClock.findMany({
        where: {
            employee_id: employee.id
        },
        orderBy: {
            date: 'desc'
        },
        take: 5
    })

    log("Recent time clocks:")
    log(JSON.stringify(recentClocks, null, 2))

    // Check all clocks for today using string comparison if possible, or wider range
    const startOfToday = new Date('2026-03-05T00:00:00Z')
    const endOfToday = new Date('2026-03-05T23:59:59Z')

    const broadClocks = await prisma.timeClock.findMany({
        where: {
            employee_id: employee.id,
            date: {
                gte: startOfToday,
                lte: endOfToday
            }
        }
    })

    log(`Broad search for 2026-03-05 (UTC range): found ${broadClocks.length} records`)
    if (broadClocks.length > 0) {
        log(JSON.stringify(broadClocks, null, 2))
    }

    fs.writeFileSync('investigation_log.txt', output)
    log("Logged to investigation_log.txt")
}

main()
    .catch((e) => {
        fs.appendFileSync('investigation_log.txt', "\nERROR: " + e.message)
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
