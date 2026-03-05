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

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // We need to pass the date as a Date object that matches the @db.Date format in Prisma (which usually ignores time but stores as Date object)
        // However, Prisma client handles JS Date objects correctly for @db.Date.

        const timeClock = await this.timeClocksRepository.findByEmployeeAndDate(employee.id, today)

        let nextAction = "clockIn"

        if (timeClock) {
            if (!timeClock.clockIn) nextAction = "clockIn"
            else if (!timeClock.breakStart) nextAction = "breakStart"
            else if (!timeClock.breakEnd) nextAction = "breakEnd"
            else if (!timeClock.clockOut) nextAction = "clockOut"
            else if (!timeClock.extraClockIn) nextAction = "extraClockIn"
            else if (!timeClock.extraClockOut) nextAction = "extraClockOut"
            else nextAction = "completed"
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
