import { PrismaClient } from '@prisma/client'
import { PrismaEmployeesRepository } from './modules/hr/repositories/prisma/prisma-employees-repository'
import { PrismaTimeClocksRepository } from './modules/hr/repositories/prisma/prisma-time-clocks-repository'
import { GetEmployeeTimeClockStatusUseCase } from './modules/hr/use-cases/get-time-clock-status'

async function main() {
    const employeesRepository = new PrismaEmployeesRepository()
    const timeClocksRepository = new PrismaTimeClocksRepository()
    const useCase = new GetEmployeeTimeClockStatusUseCase(employeesRepository, timeClocksRepository)

    try {
        const result = await useCase.execute({ pin: '1234' })
        console.log(result)
    } catch (err) {
        console.error(err)
    }
}

main()
