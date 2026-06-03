import { prisma } from "../../../../lib/prisma"
import { PayrollType } from "@prisma/client"

function getISOWeek(d: Date) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

interface Request {
    type: PayrollType
    referenceDate: string // YYYY-MM-DD
    splitCesta?: boolean
    deductDebtsOnAdvance?: boolean
}

export class GeneratePayrollBatchUseCase {
    private formatDebtsDescription(debts: any[]): string {
        if (!debts || debts.length === 0) return ""
        const byType = debts.reduce((acc, d) => {
            const t = d.type === "VALE_TRANSPORTE" ? "VT" : d.type === "CONSUMACAO" ? "Consumo" : d.type === "ERRO" ? "Quebra" : d.type === "VALE" ? "Vale" : d.type;
            acc[t] = (acc[t] || 0) + Math.abs(Number(d.amount))
            return acc
        }, {} as Record<string, number>)

        const descParts = Object.entries(byType).map(([t, v]) => `${t}: R$${v.toFixed(2)}`)
        return ` | Descontos (${descParts.join(", ")})`
    }

    async execute({ type, referenceDate, splitCesta, deductDebtsOnAdvance }: Request) {
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

                const totalPaidAlready = existingCestas.reduce((acc, c) => acc + Number(c.amount), 0)

                if (totalPaidAlready >= cestaValue) {
                    console.log(`[GenerateBatch] SKIP ${emp.name}: Already received full Cesta.`)
                    continue
                }

                if (splitCesta) {
                    amount = cestaValue / 2
                    if (totalPaidAlready + amount > cestaValue) {
                        amount = cestaValue - totalPaidAlready
                    }
                    console.log(`[GenerateBatch] ${emp.name}: Cesta -> 50% (${amount})`)
                } else {
                    amount = cestaValue - totalPaidAlready
                    console.log(`[GenerateBatch] ${emp.name}: Cesta -> Restante (${amount})`)
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
                        if (!tc.clockIn && !tc.isJustifiedAbsence) return acc;
                        const val = Number(tc.negotiatedValue) || dailyRate || 0
                        return acc + val
                    }, 0)
                    earnings = totalDiarias

                    // Diarista Debts: Only ERRO and CONSUMACAO. 
                    // Explicitly exclude VALE because their Vale is a separate 1st-15th payment, not an advance on the 16th-End payment.

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO", "VALE_TRANSPORTE"] }, // Removed VALE
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo 16-End) - Ref: ${monthName} | Diárias: R$${earnings.toFixed(2)}${this.formatDebtsDescription(debts)}`

                } else if (regType === "HOURLY") {
                    // Hourly Workers: 16th to End of PREVIOUS month (Normal Hours only)
                    const prevMonthDate = new Date(refDate)
                    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
                    const startOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 16)
                    const endOfPeriod = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfPeriod, lte: endOfPeriod }
                        }
                    })

                    const baseHours = this.calculateWorkedHours(timeClocks)
                    const dsrHours = baseHours / 6 // Descanso Semanal Remunerado
                    const totalHours = baseHours + dsrHours
                    earnings = totalHours * salary

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["ERRO", "CONSUMACAO", "VALE_TRANSPORTE"] },
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo 16-End) - Ref: ${monthName} | Horas: ${baseHours.toFixed(1)}h + DSR: ${dsrHours.toFixed(1)}h x R$${salary.toFixed(2)}${this.formatDebtsDescription(debts)}`

                } else {
                    // Fixed Employees: Base is 100% Salary.
                    // We must deduct the Advance (40%) paid on Day 20.
                    // We must find the Advance for *this reference month*, regardless if it is PAID or PENDING.

                    const unjustAbsencesCount = await prisma.timeClock.count({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfMonth },
                            clockIn: null,
                            absenceReason: "FALTA_INJUSTIFICADA"
                        }
                    })

                    // Buscar as datas das faltas para agrupar por semana
                    const unjustAbsencesDates = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfMonth },
                            clockIn: null,
                            absenceReason: "FALTA_INJUSTIFICADA"
                        },
                        select: { date: true }
                    })

                    // Agrupar por semana ISO para contar o DSR perdido
                    const weeksAffected = new Set<string>()
                    unjustAbsencesDates.forEach(tc => {
                        const d = new Date(tc.date)
                        const year = d.getFullYear()
                        const week = getISOWeek(d)
                        weeksAffected.add(`${year}-W${week}`)
                    })
                    const dsrLostCount = weeksAffected.size

                    const dailySal = salary / 30;
                    const unjustDeduction = (unjustAbsencesCount + dsrLostCount) * dailySal;

                    earnings = salary - unjustDeduction

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
                            type: { in: ["ERRO", "CONSUMACAO", "VALE_TRANSPORTE"] },
                            status: "PENDING"
                        }
                    })

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)

                    amount = earnings - advanceDeduction - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Salário (Saldo) - Ref: ${monthName} | Bruto: R$${salary.toFixed(2)}${unjustAbsencesCount > 0 ? ` | Faltas: -R$${unjustDeduction.toFixed(2)}` : ''} | Adiantamento: -R$${advanceDeduction.toFixed(2)}${this.formatDebtsDescription(debts)}`
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
                        if (!tc.clockIn && !tc.isJustifiedAbsence) return acc;
                        const val = Number(tc.negotiatedValue) || dailyRate || 0
                        return acc + val
                    }, 0)
                    earnings = totalDiarias

                    // Subtract debts? Only if deductDebtsOnAdvance is true
                    let debts: any[] = []
                    if (deductDebtsOnAdvance) {
                        debts = await prisma.payrollEntry.findMany({
                            where: {
                                employee_id: emp.id,
                                type: { in: ["VALE", "ERRO", "CONSUMACAO", "VALE_TRANSPORTE"] },
                                status: "PENDING"
                            }
                        })
                    }
                    const debtsSum = debts.reduce((acc, d) => {
                        const val = Math.abs(Number(d.amount))
                        return acc + val
                    }, 0)

                    amount = totalDiarias - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Vale (Adiantamento) - Ref: ${monthName}${this.formatDebtsDescription(debts)}`

                } else if (regType === "HOURLY") {
                    // Hourly Workers: 1st to 15th of CURRENT month (Normal Hours only)
                    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                    const endOfPeriod = new Date(refDate.getFullYear(), refDate.getMonth(), 15)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfPeriod }
                        }
                    })

                    const baseHours = this.calculateWorkedHours(timeClocks)
                    const dsrHours = baseHours / 6
                    const totalHours = baseHours + dsrHours
                    earnings = totalHours * salary

                    let debts: any[] = []
                    if (deductDebtsOnAdvance) {
                        debts = await prisma.payrollEntry.findMany({
                            where: {
                                employee_id: emp.id,
                                type: { in: ["ERRO", "CONSUMACAO", "VALE", "VALE_TRANSPORTE"] }, // Here we subtract "Vale" too if any is pending
                                status: "PENDING"
                            }
                        })
                    }

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Vale (Ref. 01-15) - Ref: ${monthName} | Horas: ${baseHours.toFixed(1)}h + DSR: ${dsrHours.toFixed(1)}h x R$${salary.toFixed(2)}${this.formatDebtsDescription(debts)}`

                } else {
                    // Fixed: 40% of Salary
                    earnings = salary * 0.40
                    if (earnings === 0) {
                        console.log(`[GenerateBatch] Warning: ${emp.name} has 0 amounts (Salary: ${salary})`)
                    }
                    
                    let debts: any[] = []
                    if (deductDebtsOnAdvance) {
                        debts = await prisma.payrollEntry.findMany({
                            where: {
                                employee_id: emp.id,
                                type: { in: ["ERRO", "CONSUMACAO", "VALE", "VALE_TRANSPORTE"] },
                                status: "PENDING"
                            }
                        })
                    }

                    const debtsSum = debts.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0)
                    amount = earnings - debtsSum
                    debtsToUpdate = debts.map(d => d.id)
                    description = `Vale (Adiantamento) - Ref: ${monthName}${this.formatDebtsDescription(debts)}`
                }
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
            if (clock.isJustifiedAbsence && !clock.clockIn) {
                totalHours += 440 / 60; // 7.333 horas = 7 horas e 20 minutos contratuais virtuais
                continue;
            }

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
