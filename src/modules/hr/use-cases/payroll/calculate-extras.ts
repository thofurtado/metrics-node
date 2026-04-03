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

        // 1. Process Employees Logic (Time Clocks)
        const allClocks = await prisma.timeClock.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            }
        })

        for (const emp of employees) {
            const empClocks = allClocks.filter(tc => tc.employee_id === emp.id)
            if (empClocks.length === 0) continue

            const regType = (emp as any).registrationType
            const salary = Number(emp.salary) || 0
            const dailyRate = Number(emp.dailyRate) || 0
            const overtimeValue = (emp as any).overtimeValue ? Number((emp as any).overtimeValue) : 0
            
            // For Horistas, if overtimeValue is not set, we use their base hourly rate (salary)
            // For others, if overtimeValue is not set, we use dailyRate / 8
            const hourlyExtraRate = overtimeValue > 0 
                ? overtimeValue 
                : (regType === "HOURLY" ? salary : (dailyRate / 8))

            let totalForEmployee = 0
            let extraHoursCount = 0
            let extraDaysCount = 0

            for (const clock of empClocks) {
                // CASE A: It's marked as an Extra Day (Shift entierly extra)
                if (clock.isExtraDay) {
                    if (clock.negotiatedValue && Number(clock.negotiatedValue) > 0) {
                        totalForEmployee += Number(clock.negotiatedValue)
                        extraDaysCount++
                    } else if (clock.clockIn && clock.clockOut) {
                        const start = new Date(clock.clockIn).getTime()
                        const end = new Date(clock.clockOut).getTime()
                        let durationMs = end - start
                        if (clock.breakStart && clock.breakEnd) {
                            durationMs -= (new Date(clock.breakEnd).getTime() - new Date(clock.breakStart).getTime())
                        }
                        const hours = durationMs / (1000 * 60 * 60)
                        if (hours > 0) {
                            totalForEmployee += hours * hourlyExtraRate
                            extraHoursCount += hours
                        }
                    } else if (regType === "DAILY" || regType === "UNREGISTERED") {
                        totalForEmployee += dailyRate
                        extraDaysCount++
                    }
                } 
                // CASE B: Normal Day, but with specific Extra Hours recorded in extraClockIn/Out
                else if (clock.extraClockIn && clock.extraClockOut) {
                    const extraStart = new Date(clock.extraClockIn).getTime()
                    const extraEnd = new Date(clock.extraClockOut).getTime()
                    const extraDurationMs = extraEnd - extraStart
                    const extraHours = extraDurationMs / (1000 * 60 * 60)
                    
                    if (extraHours > 0) {
                        totalForEmployee += extraHours * hourlyExtraRate
                        extraHoursCount += extraHours
                    }
                }
            }

            if (totalForEmployee > 0) {
                totalExtras += totalForEmployee
                breakdown.push({
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: (regType === "DAILY" || regType === "UNREGISTERED") ? "DIARISTA" : "HORA_EXTRA",
                    description: extraHoursCount > 0 
                        ? `${extraHoursCount.toFixed(1)}h extras${extraDaysCount > 0 ? ` + ${extraDaysCount} dias integ.` : ''}`
                        : `${extraDaysCount} dia(s) extra(s)`,
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
