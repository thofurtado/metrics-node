import { prisma } from "../../../../lib/prisma"

export class PrismaEmployeesRepository {
    async findByPin(pin: string) {
        const employee = await prisma.employee.findFirst({
            where: {
                pin,
            },
        })

        return employee
    }
}
