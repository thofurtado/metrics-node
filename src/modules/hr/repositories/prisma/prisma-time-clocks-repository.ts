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
        try {
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
        } catch (err: any) {
            if (err?.code === 'P2022' || err?.message?.includes('allow_term_sales')) {
                const timeClock = await prisma.timeClock.findUnique({
                    where: {
                        employee_id_date: {
                            employee_id,
                            date,
                        },
                    },
                    include: {
                        employee: {
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
                        }
                    }
                })

                return timeClock as any
            }
            throw err
        }
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
