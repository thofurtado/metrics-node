import { PrismaEmployeesRepository } from "../repositories/prisma/prisma-employees-repository"
import { PrismaTimeClocksRepository } from "../repositories/prisma/prisma-time-clocks-repository"
import { getCompetenceDate } from "../../../utils/get-competence-date"

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

        const now = new Date()
        const competenceDate = getCompetenceDate(now)

        const timeClock = await this.timeClocksRepository.findByEmployeeAndDate(employee.id, competenceDate)

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
