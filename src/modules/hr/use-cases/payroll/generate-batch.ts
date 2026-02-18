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
            const transport = Number(emp.transportAllowance) || 0

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

                // 100% for Registered, 50% for Unregistered
                if (emp.isRegistered) {
                    amount = cestaValue
                    console.log(`[GenerateBatch] ${emp.name}: Registered -> 100% (${amount})`)
                } else {
                    amount = cestaValue / 2
                    console.log(`[GenerateBatch] ${emp.name}: Unregistered -> 50% (${amount})`)
                }
                description = `Cesta Básica - Ref: ${monthName}`

            } else if (type === "VALE_TRANSPORTE") {
                if (transport <= 0) continue
                amount = transport
                description = `Vale Transporte - Ref: ${monthName}`

            } else if (type === "SALARIO_60") {
                // Pagamento Dia 05 (Saldo de Salário)
                let earnings = 0

                if (regType === "DAILY") {
                    // Diaristas: 16th to End of PREVIOUS month
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
                    const totalDiarias = timeClocks.reduce((acc, tc) => acc + (Number(tc.negotiatedValue) || 0), 0)
                    earnings = totalDiarias
                } else {
                    // Fixed Employees: 60% of Salary
                    earnings = salary * 0.60
                }

                // Subtrair débitos: VALE + ERRO + CONSUMACAO
                const debts = await prisma.payrollEntry.findMany({
                    where: {
                        employee_id: emp.id,
                        type: { in: ["VALE", "ERRO", "CONSUMACAO"] },
                        status: "PENDING"
                    }
                })

                const debtsSum = debts.reduce((acc, d) => {
                    const val = Number(d.amount)
                    // VALE is usually positive in DB, so we subtract it from earnings.
                    // ERRO/CONSUMACAO are usually negative (debts), so we add them (reducing total).
                    if (val > 0 && d.type === "VALE") return acc - val
                    return acc + val
                }, 0)

                amount = earnings + debtsSum
                debtsToUpdate = debts.map(d => d.id)
                description = `Salário (Saldo) - Ref: ${monthName}`

            } else if (type === "VALE") {
                // Adiantamento Dia 20 (40%)
                if (regType === "DAILY") {
                    // Diaristas: 1st to 15th of CURRENT month
                    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
                    const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 15)

                    const timeClocks = await prisma.timeClock.findMany({
                        where: {
                            employee_id: emp.id,
                            date: { gte: startOfMonth, lte: endOfMonth },
                        }
                    })
                    const totalDiarias = timeClocks.reduce((acc, tc) => acc + (Number(tc.negotiatedValue) || 0), 0)
                    amount = totalDiarias

                    const debts = await prisma.payrollEntry.findMany({
                        where: {
                            employee_id: emp.id,
                            type: { in: ["VALE", "ERRO", "CONSUMACAO"] },
                            status: "PENDING"
                        }
                    })
                    const debtsSum = debts.reduce((acc, d) => {
                        const val = Number(d.amount)
                        if (val > 0 && d.type === "VALE") return acc - val
                        return acc + val
                    }, 0)
                    amount += debtsSum

                } else {
                    // Fixed: 40% of Salary
                    amount = salary * 0.40
                }
                description = `Vale (Adiantamento) - Ref: ${monthName}`
            } else {
                // Other types not supported for batch generation yet
                continue
            }

            if (amount <= 0 && type !== 'SALARIO_60') {
                console.log(`[GenerateBatch] SKIP ${emp.name}: Calculated amount is 0 or negative (${amount}).`)
                continue
            }

            // Check Duplicate (Same Type, Same Month)
            const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
            const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)

            // Normalize type for duplicate check and creation
            const normalizedType = (type === "BENEFICIO") ? "CESTA_BASICA" : type

            const exists = await prisma.payrollEntry.findFirst({
                where: {
                    employee_id: emp.id,
                    type: normalizedType,
                    referenceDate: { gte: startOfMonth, lte: endOfMonth }
                }
            })

            if (exists) {
                console.log(`[GenerateBatch] SKIP ${emp.name}: Duplicate entry found for this month (${normalizedType}).`)
                continue
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

            if (debtsToUpdate.length > 0) {
                await prisma.payrollEntry.updateMany({
                    where: { id: { in: debtsToUpdate } },
                    data: { status: "PAID" }
                })
            }
            count++
        }

        if (count === 0) {
            console.warn("[GenerateBatch] Batch finished with 0 entries created.")
            if (type === "CESTA_BASICA" || type === "BENEFICIO") {
                return { count: 0, message: "Nenhum registro gerado. Verifique se o valor da cesta está configurado e se os funcionários possuem o benefício ativo no cadastro." }
            }
        }

        return { count, message: "Batch processed successfully" }
    }
}
