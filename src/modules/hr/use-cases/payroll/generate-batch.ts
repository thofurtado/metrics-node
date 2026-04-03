import { prisma } from "../../../../lib/prisma"
import { PayrollType } from "@prisma/client"

interface Request {
    type: PayrollType
    referenceDate: string // YYYY-MM-DD
}

export class GeneratePayrollBatchUseCase {
    async execute({ type, referenceDate }: Request) {
        console.log(`[GenerateBatch] Starting batch for type: ${type}, date: ${referenceDate}`)

        const refDate = new Date(referenceDate)
        // Manual month name map to avoid locale issues
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        const monthName = months[refDate.getMonth()]

        // 1. Fetch System Config (for Cesta Value)
        const config = await prisma.systemConfig.findFirst({
            where: { hr_module: true },
            orderBy: { updated_at: 'desc' }
        })
        const cestaValue = Number(config?.cestaBasicaValue || 0)
        console.log(`[GenerateBatch] Type: ${type}, RefDate: ${referenceDate}, CestaValue: ${cestaValue}`)

        // 2. Fetch Employees
        const employees = await prisma.employee.findMany()
        console.log(`[GenerateBatch] Found ${employees.length} employees.`)

        if (employees.length === 0) {
            return { count: 0, message: "No employees found." }
        }

        let count = 0

        for (const emp of employees) {
            let amount = 0
            let description = ""
            let debtsToUpdate: string[] = []

            const regType = emp.registrationType
            const salary = Number(emp.salary) || 0
            const dailyRate = Number(emp.dailyRate) || 0
            const transport = Number(emp.transportAllowance) || 0

            // --- LOGIC SELECTION ---

            // ... (inside loop)

            // --- LOGIC SELECTION ---

            if (type.toUpperCase() === "CESTA_BASICA" || type.toUpperCase() === "BENEFICIO") {
                if (!emp.hasCestaBasica) {
                    console.log(`[GenerateBatch] SKIP ${emp.name}: No hasCestaBasica entitlement`)
                    continue
                }

                if (cestaValue <= 0) {
                    console.error(`[GenerateBatch] ERROR: Cesta Value is 0 in System Config!`)
                    throw new Error("Valor da Cesta Básica não configurado ou zerado nas Configurações do Sistema.")
                }

                // Check existing entries for this month
                const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)

                const existingCestas = await prisma.payrollEntry.findMany({
                    where: {
                        employee_id: emp.id,
                        type: { in: ["CESTA_BASICA", "BENEFICIO"] },
                        referenceDate: { gte: startOfMonth, lte: endOfMonth }
                    }
                })

                if (emp.isRegistered) {
                    // Registered: 100% in one go. If any exists, skip.
                    if (existingCestas.length > 0) {
                        console.log(`[GenerateBatch] SKIP ${emp.name}: Registered already received Cesta.`)
                        continue
                    }
                    amount = cestaValue
                    console.log(`[GenerateBatch] ${emp.name}: Registered -> 100% (${amount})`)
                } else {
                    // Unregistered: 2 installments of 50%
                    if (existingCestas.length >= 2) {
                        console.log(`[GenerateBatch] SKIP ${emp.name}: Unregistered already received 2 Installments.`)
                        continue
                    }

                    amount = cestaValue / 2

                    if (existingCestas.length === 0) {
                        console.log(`[GenerateBatch] ${emp.name}: Unregistered -> 1st Installment 50% (${amount})`)
                    } else {
                        console.log(`[GenerateBatch] ${emp.name}: Unregistered -> 2nd Installment 50% (${amount})`)
                    }
                }
                description = `Cesta Básica - Ref: ${monthName}`


            } else if (type === "VALE_TRANSPORTE") {
                // EXCLUSIVE LOGIC: Only filter by transport value for this specific type
                if (transport <= 0) {
                    console.log(`[GenerateBatch] SKIP ${emp.name}: Transport value is 0`)
                    continue
                }
                amount = transport
                description = `Vale Transporte - Ref: ${monthName}`

            } else if (type === "SALARIO_60") {
                // Pagamento Dia 05 (Saldo de Salário)
                let earnings = 0
                let advanceDeduction = 0

                const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)

                if (regType === "DAILY") {
                    // Diaristas: 16th to End of PREVIOUS month
                    // Logic: Diaristas are paid purely on production.
                    // The "Vale" (Day 20) covers 1-15.
                    // This "Salary" (Day 5) covers 16-End.
                    // They are independent. We do NOT deduct the Vale here.

                    const prevMonthDate = new Date(refDate)
                    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)

                    const startOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 16)
                    const endOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfPeriod, lte: endOfPeriod },
                        }
                    })
                    const totalDiarias = timeClocks.reduce((acc, tc) => {
                        const val = Number(tc.negotiatedValue) || dailyRate || 0
                        return acc + val
                    }, 0)
                    earnings = totalDiarias

                    // Diarista Debts: Only ERRO and CONSUMACAO. 
                    // Explicitly exclude VALE because their Vale is a separate 1st-15th payment, not an advance on the 16th-End payment.

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO"] }, // Removed VALE
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo 16-End) - Ref: ${monthName} | Diárias: R$${earnings.toFixed(2)}${debtsSum > 0 ? ` | Descontos: -R$${debtsSum.toFixed(2)}` : ''}`

                } else if (regType === "HOURLY") {
                    // Hourly Workers: 16th to End of PREVIOUS month (Normal Hours only)
                    const prevMonthDate = new Date(refDate)
                    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
                    const startOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 16)
                    const endOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfPeriod, lte: endOfPeriod },
                            isExtraDay: false
                        }
                    })

                    const totalHours = this.calculateWorkedHours(timeClocks)
                    earnings = totalHours * salary

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO"] },
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo 16-End) - Ref: ${monthName} | Horas: ${totalHours.toFixed(1)}h x R$${salary.toFixed(2)}${debtsSum > 0 ? ` | Descontos: -R$${debtsSum.toFixed(2)}` : ''}`

                } else {
                    // Fixed Employees: Base is 100% Salary.
                    // We must deduct the Advance (40%) paid on Day 20.
                    // We must find the Advance for *this reference month*, regardless if it is PAID or PENDING.

                    earnings = salary

                    // 1. Find the Advance (Vale) for this month
                    const advanceEntry = await prisma.payrollEntry.findFirst({
                        where: {
                            employee_id: emp.id,
                            type: "VALE",
                            description: { contains: "Adiantamento" },
                            referenceDate: { gte: startOfMonth, lte: endOfMonth }
                        }
                    })

                    if (advanceEntry) {
                        advanceDeduction = Number(advanceEntry.amount)
                    }

                    // 2. Find other Debts (Pending Erros/Consumacao)
                    // Note: If there was a Vale appearing as "Pending", the query above caught it as deduction.
                    // We should only look for ERRO/CONSUMACAO here to avoid double counting if we looked for VALE again.
                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO"] },
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)

                    amount = earnings - advanceDeduction - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo) - Ref: ${monthName} | Bruto: R$${earnings.toFixed(2)} | Adiantamento: -R$${advanceDeduction.toFixed(2)}${debtsSum > 0 ? ` | Descontos: -R$${debtsSum.toFixed(2)}` : ''}`
                }

            } else if (type === "VALE") {
                // Adiantamento Dia 20 (40%)
                // Fixed: Logic for all active employees regardless of transport allowance.
                let earnings = 0

                if (regType === "DAILY") {
                    // Diaristas: 1st to 15th of CURRENT month
                    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                    const endOfPeriod = new Date(refDate.getFullYear(), refDate.getMonth(), 15)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfPeriod },
                        }
                    })
                    const totalDiarias = timeClocks.reduce((acc, tc) => {
                        const val = Number(tc.negotiatedValue) || dailyRate || 0
                        return acc + val
                    }, 0)
                    earnings = totalDiarias

                    // Subtract debts? Usually yes.
                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["VALE", "ERRO", "CONSUMACAO"] },
                            status: "PENDING"
                        }
                    })
                    const debtsSum = debts.reduce((acc, d) => {
                        const val = Math.abs(Number(d.amount))
                        return acc + val
                    }, 0)

                    amount = totalDiarias - debtsSum
                    // For Diaristas, if we subtract debts here, we should mark them as PAID so they aren't subtracted again on Day 5?
                    // But usually Diaristas get paid twice a month independently.
                    // So yes, mark debts as PAID using debtsToUpdate.
                    debtsToUpdate = debts.map(d => d.id)

                } else if (regType === "HOURLY") {
                    // Hourly Workers: 1st to 15th of CURRENT month (Normal Hours only)
                    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                    const endOfPeriod = new Date(refDate.getFullYear(), refDate.getMonth(), 15)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfPeriod },
                            isExtraDay: false
                        }
                    })

                    const totalHours = this.calculateWorkedHours(timeClocks)
                    earnings = totalHours * salary

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO", "VALE"] }, // Here we subtract "Vale" too if any is pending
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Vale (Ref. 01-15) - Ref: ${monthName} | Horas: ${totalHours.toFixed(1)}h x R$${salary.toFixed(2)}${debtsSum > 0 ? ` | Descontos: -R$${debtsSum.toFixed(2)}` : ''}`

                } else {
                    // Fixed: 40% of Salary
                    amount = salary * 0.40
                    if (amount === 0) {
                        console.log(`[GenerateBatch] Warning: ${emp.name} has 0 amounts (Salary: ${salary})`)
                    }
                    // We do NOT subtract debts for Fixed employees on the Advance (Day 20).
                    // Debts are subtracted on Day 5 Balancing.
                }
                description = `Vale (Adiantamento) - Ref: ${monthName}`
            } else {
                continue
            }

            if (amount <= 0 && type !== 'SALARIO_60') {
                console.log(`[GenerateBatch] SKIP ${emp.name}: Calculated amount is 0 or negative (${amount}).`)
                continue
            }

            // Custom Duplicate Check handled inside specific blocks for Cesta.
            // For others, run the standard check.

            const normalizedType = (type === "BENEFICIO") ? "CESTA_BASICA" : type

            if (type !== 'CESTA_BASICA' && type !== 'BENEFICIO') {
                const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)

                // Construct filters for duplicate check
                let duplicateWhere: any = {
                    employee_id: emp.id,
                    type: normalizedType,
                    referenceDate: { gte: startOfMonth, lte: endOfMonth }
                }

                // If Type is VALE, be specific to avoid collision with manual vales
                if (normalizedType === 'VALE') {
                    duplicateWhere.description = { startsWith: `Vale (Adiantamento)` }
                }

                const exists = await prisma.payrollEntry.findFirst({
                    where: duplicateWhere
                })

                if (exists) {
                    console.log(`[GenerateBatch] SKIP ${emp.name}: Duplicate entry found for this month (${normalizedType}).`)
                    continue
                }
            }

            await prisma.payrollEntry.create({
                data: {
                    employee_id: emp.id,
                    type: normalizedType,
                    amount: amount,
                    description: description,
                    referenceDate: refDate,
                    status: "PENDING"
                }
            })

            // Note: Debts stay as PENDING until consolidation (as requested)
            // if (debtsToUpdate.length > 0) {
            //     await prisma.payrollEntry.updateMany({
            //         where: { id: { in: debtsToUpdate } },
            //         data: { status: "PAID" }
            //     })
            // }
            count++
        }

        if (count === 0) {
            // ... existing warning logic
            console.warn("[GenerateBatch] Batch finished with 0 entries created.")
            if (type === "CESTA_BASICA" || type === "BENEFICIO") {
                return { count: 0, message: "Nenhum registro gerado. Verifique se o valor da cesta está configurado e se os funcionários possuem o benefício ativo no cadastro." }
            }
            return { count: 0, message: "Nenhum registro gerado." }
        }

        return { count, message: "Batch processed successfully" }
    }

    private calculateWorkedHours(timeClocks: any[]): number {
        let totalHours = 0

        for (const clock of timeClocks) {
            if (clock.clockIn && clock.clockOut) {
                const start = new Date(clock.clockIn).getTime()
                const end = new Date(clock.clockOut).getTime()
                let durationMs = end - start

                if (clock.breakStart && clock.breakEnd) {
                    durationMs -= (new Date(clock.breakEnd).getTime() - new Date(clock.breakStart).getTime())
                }

                // Convert to hours
                const hours = durationMs / (1000 * 60 * 60)
                if (hours > 0) totalHours += hours
            }
        }

        return totalHours
    }
}
