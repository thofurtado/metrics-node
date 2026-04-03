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
            const empClocks = timeClocks.filter(tc => tc.employee_id === emp.id && tc.isExtraDay)
            if (empClocks.length === 0) continue

            const regType = (emp as any).registrationType
            const hourlyRate = (emp as any).overtimeValue ? Number((emp as any).overtimeValue) : 0
            const dailyRate = Number(emp.dailyRate) || 0

            let totalForEmployee = 0
            let extraHoursCount = 0
            let negotiatedDaysCount = 0

            for (const clock of empClocks) {
                // Priority 1: Negotiated fixed value for the specific day
                if (clock.negotiatedValue && Number(clock.negotiatedValue) > 0) {
                    totalForEmployee += Number(clock.negotiatedValue)
                    negotiatedDaysCount++
                } 
                // Priority 2: Hours-based calculation
                else if (clock.clockIn && clock.clockOut) {
                    const start = new Date(clock.clockIn).getTime()
                    const end = new Date(clock.clockOut).getTime()
                    let durationMs = end - start

                    if (clock.breakStart && clock.breakEnd) {
                        durationMs -= (new Date(clock.breakEnd).getTime() - new Date(clock.breakStart).getTime())
                    }

                    const hours = durationMs / (1000 * 60 * 60)
                    if (hours > 0) {
                        const rate = (regType === "DAILY" || regType === "UNREGISTERED") ? dailyRate / 8 : hourlyRate
                        totalForEmployee += hours * rate
                        extraHoursCount += hours
                    }
                }
                // Priority 3: Fallback to daily rate for Daily workers
                else if (regType === "DAILY" || regType === "UNREGISTERED") {
                    totalForEmployee += dailyRate
                    negotiatedDaysCount++
                }
            }

            if (totalForEmployee > 0) {
                totalExtras += totalForEmployee
                breakdown.push({
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: (regType === "DAILY" || regType === "UNREGISTERED") ? "DIARISTA" : "HORA_EXTRA",
                    description: extraHoursCount > 0 
                        ? `${extraHoursCount.toFixed(1)}h extras + ${negotiatedDaysCount} dias negociados`
                        : `${negotiatedDaysCount} dia(s) extra(s) / negociado(s)`,
                    value: totalForEmployee
                })
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
