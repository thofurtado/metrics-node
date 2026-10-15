import { prisma } from "../../../../lib/prisma"

// Fase 4 do Mergulho (01:R13): o banco não impede dois cadastros com o mesmo PIN (só o cadastro da web barra). Se acontecer,
// vale o cadastro ATIVO (e, entre ativos, o mais antigo), para um desligado antigo não tomar o lugar de quem trabalha.
const ORDEM_DO_PIN = [{ isRegistered: "desc" as const }, { created_at: "asc" as const }]

export class PrismaEmployeesRepository {
    async findByPin(pin: string) {
        try {
            const employee = await prisma.employee.findFirst({
                where: {
                    pin,
                },
                orderBy: ORDEM_DO_PIN,
            })

            return employee
        } catch (err: any) {
            if (err?.code === 'P2022' || err?.message?.includes('allow_term_sales')) {
                const employee = await prisma.employee.findFirst({
                    where: { pin },
                    orderBy: ORDEM_DO_PIN,
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        registrationType: true,
                        isRegistered: true,
                        admissionDate: true,
                        pin: true,
                        salary: true,
                        dailyRate: true,
                        points: true,
                        transportAllowance: true,
                        hasCestaBasica: true,
                        photo_url: true,
                        created_at: true,
                        updated_at: true,
                    }
                })
                if (!employee) return null
                return {
                    ...employee,
                    allow_term_sales: false,
                    term_credit_limit: 0,
                } as any
            }
            throw err
        }
    }
}
