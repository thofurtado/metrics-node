import { PrismaEmployeesRepository } from "../repositories/prisma/prisma-employees-repository"
import { PrismaTimeClocksRepository } from "../repositories/prisma/prisma-time-clocks-repository"

interface Request {
    pin: string
}

export class GetEmployeeTimeClockStatusUseCase {
    constructor(
        private employeesRepository: PrismaEmployeesRepository,
        private timeClocksRepository: PrismaTimeClocksRepository
    ) { }

    async execute({ pin }: Request) {
        const employee = await this.employeesRepository.findByPin(pin)

        if (!employee) {
            throw new Error("Employee not found")
        }

        if (!employee.isRegistered) {
            throw new Error("Employee inactive")
        }

        // BUGFIX: Use UTC-based date construction to avoid server timezone affecting
        // the date lookup. The @db.Date field stores pure dates in UTC midnight.
        const now = new Date()
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

        // We need to pass the date as a Date object that matches the @db.Date format in Prisma (which usually ignores time but stores as Date object)
        // However, Prisma client handles JS Date objects correctly for @db.Date.

        const timeClock = await this.timeClocksRepository.findByEmployeeAndDate(employee.id, today)

        // Determine next action based on sequential clock fields
        let nextAction: string | null = "clockIn"

        if (timeClock) {
            if (!timeClock.clockIn) nextAction = "clockIn"
            else if (!timeClock.breakStart) nextAction = "breakStart"
            else if (!timeClock.breakEnd) nextAction = "breakEnd"
            else if (!timeClock.clockOut) nextAction = "clockOut"
            else if (!timeClock.extraClockIn) nextAction = "extraClockIn"
            else if (!timeClock.extraClockOut) nextAction = "extraClockOut"
            else nextAction = null // null = all 6 slots filled (daily limit reached)
        }

        return {
            employee: {
                id: employee.id,
                name: employee.name,
            },
            timeClock,
            nextAction,
        }
    }
}
