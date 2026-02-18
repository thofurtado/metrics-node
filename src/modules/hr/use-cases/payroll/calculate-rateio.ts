import { prisma } from "../../../../lib/prisma"
import { CalculateRateioExtrasUseCase } from "./calculate-extras"

interface Request {
    month: number
    year: number
    paymentDate: string
    totalRevenue: number
    lostPercentage: number
}

export class CalculatePointRateioUseCase {
    async execute({ month, year, paymentDate, totalRevenue, lostPercentage }: Request) {
        // 1. Get Extras
        const extrasUseCase = new CalculateRateioExtrasUseCase()
        const { totalExtras } = await extrasUseCase.execute({ month, year })

        // 2. Calculate Net Revenue (Revenue - Loss)
        // Loss is percentage of TOTAL Revenue
        const lossAmount = totalRevenue * (lostPercentage / 100)
        const netRevenue = totalRevenue - lossAmount

        // 3. Subtract Extras
        const baseForRateio = netRevenue - totalExtras

        if (baseForRateio <= 0) {
            throw new Error(`Base para rateio é zero ou negativa (${baseForRateio.toFixed(2)}). Verifique faturamento ou extras.`)
        }

        // 4. Apply 10%
        const finalRateioPool = baseForRateio * 0.10

        // 5. Distribute Points
        const employees = await prisma.employee.findMany({
            where: {
                points: { gt: 0 }
            }
        })

        if (employees.length === 0) {
            throw new Error("No eligible employees with points found.")
        }

        const totalPoints = employees.reduce((acc, emp) => acc + emp.points, 0)
        const pointValue = finalRateioPool / totalPoints

        const snapshotDate = new Date() // Creation date
        const payDate = new Date(paymentDate)

        // Used for description range
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0)

        const snapshots = []

        for (const emp of employees) {
            const empShare = emp.points * pointValue

            // Create Snapshot
            const snapshot = await prisma.employeePointSnapshot.create({
                data: {
                    employee_id: emp.id,
                    snapshotDate: snapshotDate,
                    points: emp.points,
                    pointValue: pointValue as any,
                    totalAmount: empShare as any
                }
            })
            snapshots.push(snapshot)

            // Create Payroll Entry
            await prisma.payrollEntry.create({
                data: {
                    employee_id: emp.id,
                    description: `Pontuação Ref: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
                    amount: empShare as any,
                    type: "PONTUACAO_10",
                    referenceDate: payDate,
                    status: "PENDING"
                }
            })
        }

        return {
            totalRevenue,
            lossAmount,
            totalExtras,
            netRevenue,
            baseForRateio,
            finalRateioPool,
            totalPoints,
            pointValue,
            processedEmployees: employees.length
        }
    }
}
