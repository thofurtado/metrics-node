import { prisma } from "../../../../lib/prisma"

interface Request {
    month: number
    year: number
}

interface BreakdownItem {
    employeeId: string
    employeeName: string
    type: "DIARISTA" | "HORA_EXTRA" | "MANUAL"
    description: string
    value: number
}

interface Response {
    totalExtras: number
    breakdown: BreakdownItem[]
}

export class CalculateRateioExtrasUseCase {
    async execute({ month, year }: Request): Promise<Response> {
        // Date range for the month
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0) // Last day of month

        const employees = await prisma.employee.findMany()

        // Fetch TimeClocks
        const timeClocks = await prisma.timeClock.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            }
        })

        // Fetch Manual Entries (PayrollEntry)
        const manualEntries = await prisma.payrollEntry.findMany({
            where: {
                referenceDate: { gte: startDate, lte: endDate },
                type: { in: ["DIA_EXTRA", "OTHER"] },
                status: { not: "CANCELED" } // Exclude canceled
            }
        })

        let totalExtras = 0
        const breakdown: BreakdownItem[] = []

        // 1. Process Employees Logic
        for (const emp of employees) {
            const empClocks = timeClocks.filter(tc => tc.employee_id === emp.id)
            const regType = (emp as any).registrationType

            // Diaristas OR Unregistered (treated as Daily)
            if (regType === "DAILY" || regType === "UNREGISTERED") {
                const daysWorked = empClocks.length
                const dailyValue = Number(emp.dailyRate) || 0

                if (daysWorked > 0 && dailyValue > 0) {
                    const value = daysWorked * dailyValue
                    totalExtras += value
                    breakdown.push({
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: "DIARISTA",
                        description: `${daysWorked} dias trabalhado(s) x R$ ${dailyValue.toFixed(2)}`,
                        value
                    })
                }
            }
            // Registered - Extra Hours
            else {
                const overtimeRate = Number((emp as any).overtimeValue) || 0

                let totalHours = 0

                for (const clock of empClocks) {
                    if (clock.isExtraDay && clock.clockIn && clock.clockOut) {
                        const start = clock.clockIn.getTime()
                        const end = clock.clockOut.getTime()
                        let durationMs = end - start

                        if (clock.breakStart && clock.breakEnd) {
                            durationMs -= (clock.breakEnd.getTime() - clock.breakStart.getTime())
                        }

                        // Convert to hours
                        const hours = durationMs / (1000 * 60 * 60)
                        if (hours > 0) totalHours += hours
                    }
                }

                if (totalHours > 0 && overtimeRate > 0) {
                    const value = totalHours * overtimeRate
                    totalExtras += value
                    breakdown.push({
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: "HORA_EXTRA",
                        description: `${totalHours.toFixed(1)} horas extras x R$ ${overtimeRate.toFixed(2)}`,
                        value
                    })
                }
            }
        }

        // 2. Manual Entries
        for (const entry of manualEntries) {
            // Avoid double counting if manual entry is for a Diarista? 
            // For now, allow it as "Manual Addition" implies something extra.
            const emp = employees.find(e => e.id === entry.employee_id)
            const val = Number(entry.amount)
            totalExtras += val
            breakdown.push({
                employeeId: entry.employee_id,
                employeeName: emp?.name || "Desconhecido",
                type: "MANUAL",
                description: entry.description || "Lançamento Manual",
                value: val
            })
        }

        return {
            totalExtras,
            breakdown
        }
    }
}
