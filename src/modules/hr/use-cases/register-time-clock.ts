import { PrismaEmployeesRepository } from "../repositories/prisma/prisma-employees-repository"
import { PrismaTimeClocksRepository } from "../repositories/prisma/prisma-time-clocks-repository"

interface Request {
    pin: string
    action: "clockIn" | "breakStart" | "breakEnd" | "clockOut" | "extraClockIn" | "extraClockOut"
    timestamp?: string
}

export class RegisterTimeClockUseCase {
    constructor(
        private employeesRepository: PrismaEmployeesRepository,
        private timeClocksRepository: PrismaTimeClocksRepository
    ) { }

    async execute({ pin, action, timestamp }: Request) {
        const employee = await this.employeesRepository.findByPin(pin)

        if (!employee) {
            throw new Error("Employee not found")
        }

        const now = timestamp ? new Date(timestamp) : new Date()

        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        let timeClock = await this.timeClocksRepository.findByEmployeeAndDate(employee.id, today)

        // TODO: Validate if action is allowed (e.g. can't breakStart if not clockIn)
        // For now, we trust the UI or just update whatever field is requested if it's empty?
        // Robustness: Check current state.

        // Simplification for MVP: We just update the field requested.

        if (!timeClock) {
            if (action !== "clockIn") {
                throw new Error("Must clock in first")
            }

            timeClock = await this.timeClocksRepository.create({
                employee_id: employee.id,
                date: today,
                clockIn: now,
            })
        } else {
            // Record exists.
            const existingValue = timeClock[action]

            if (existingValue) {
                // Idempotency check: If the existing timestamp matches the incoming request (within minimal tolerance or exact match), return success.
                // Since we parse strings to Dates, we compare getTime().
                // However, exact equality might be strict if DB creates microseconds diff.
                // For this use case, if the existing record is within 60 seconds of the request, we deem it a retry of the same action.
                // OR simpler: if it exists, strict fail unless we know for sure it's the SAME request ID (which we don't have yet).
                // Let's rely on exact ISO string match from client if possible, but JS Date objects lose this.
                // BETTER APPROACH FOR RETRY: Client sends same timestamp.

                const diff = Math.abs(existingValue.getTime() - now.getTime())
                if (diff < 2000) { // 2 seconds tolerance for "same request" retries
                    // It's a duplicate request for the same action. Return success to clear the client queue.
                    return {
                        employee: {
                            name: employee.name,
                        },
                        action,
                        timestamp: existingValue, // Return the originally saved timestamp
                    }
                }

                throw new Error(`Action ${action} already recorded at ${existingValue.toISOString()}`)
            }

            // Basic validation flow
            if (action === "breakStart" && !timeClock.clockIn) throw new Error("Must clock in before break")
            if (action === "breakEnd" && !timeClock.breakStart) throw new Error("Must start break before ending it")
            if (action === "clockOut" && !timeClock.clockIn) throw new Error("Must clock in before clock out")
            if (action === "extraClockIn" && !timeClock.clockOut) throw new Error("Must do standard clock out before doing an extra shift")
            if (action === "extraClockOut" && !timeClock.extraClockIn) throw new Error("Must start extra shift before clicking extra shift checkout")

            await this.timeClocksRepository.update(timeClock.id, {
                [action]: now
            })
        }

        return {
            employee: {
                name: employee.name,
            },
            action,
            timestamp: now,
        }
    }
}
