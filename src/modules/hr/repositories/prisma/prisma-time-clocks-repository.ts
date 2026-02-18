import { prisma } from "../../../../lib/prisma"
import { TimeClock } from "@prisma/client"
import { TimeClocksRepository } from "../time-clocks-repository"

export class PrismaTimeClocksRepository implements TimeClocksRepository {
    async create(data: { employee_id: string; date: Date; clockIn: Date }): Promise<TimeClock> {
        const timeClock = await prisma.timeClock.create({
            data,
        })

        return timeClock
    }

    async findByEmployeeAndDate(employee_id: string, date: Date): Promise<TimeClock | null> {
        const timeClock = await prisma.timeClock.findUnique({
            where: {
                employee_id_date: {
                    employee_id,
                    date,
                },
            },
            include: {
                employee: true,
            }
        })

        return timeClock
    }

    async update(id: string, data: Partial<TimeClock>): Promise<TimeClock> {
        const timeClock = await prisma.timeClock.update({
            where: {
                id,
            },
            data,
        })

        return timeClock
    }
}
