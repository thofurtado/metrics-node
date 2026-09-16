import { prisma } from "../../../../lib/prisma"

export class PrismaEmployeesRepository {
    async findByPin(pin: string) {
        try {
            const employee = await prisma.employee.findFirst({
                where: {
                    pin,
                },
            })

            return employee
        } catch (err: any) {
            if (err?.code === 'P2022' || err?.message?.includes('allow_term_sales')) {
                const employee = await prisma.employee.findFirst({
                    where: { pin },
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
