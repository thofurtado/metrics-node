import { TimeClock } from "@prisma/client"

export interface TimeClocksRepository {
    create(data: { employee_id: string; date: Date; clockIn: Date }): Promise<TimeClock>
    findByEmployeeAndDate(employee_id: string, date: Date): Promise<TimeClock | null>
    update(id: string, data: Partial<TimeClock>): Promise<TimeClock>
}
