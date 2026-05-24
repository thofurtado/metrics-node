import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { GetEmployeeTimeClockStatusUseCase } from "../../use-cases/get-time-clock-status"
import { RegisterTimeClockUseCase } from "../../use-cases/register-time-clock"
import { PrismaEmployeesRepository } from "../../repositories/prisma/prisma-employees-repository"
import { PrismaTimeClocksRepository } from "../../repositories/prisma/prisma-time-clocks-repository"

// Dependencies (In a real app, use dependency injection)
const employeesRepository = new PrismaEmployeesRepository()
const timeClocksRepository = new PrismaTimeClocksRepository()

export async function getStatus(request: FastifyRequest, reply: FastifyReply) {
    const getStatusQuerySchema = z.object({
        pin: z.string(),
    })

    const { pin } = getStatusQuerySchema.parse(request.query)

    console.log("Buscando PIN:", pin, "Tipo:", typeof pin)

    const getStatusUseCase = new GetEmployeeTimeClockStatusUseCase(
        employeesRepository,
        timeClocksRepository
    )

    try {
        const { employee, timeClock, nextAction } = await getStatusUseCase.execute({
            pin,
        })

        return reply.status(200).send({
            employee,
            timeClock,
            nextAction,
        })
    } catch (err: any) {
        console.error("GET /time-clock/status Error:", err)

        if (err.message === "Employee not found") {
            return reply.status(404).send({
                error: true,
                message: "Funcionário não encontrado",
                code: "EMPLOYEE_NOT_FOUND"
            })
        }

        if (err.message === "Employee inactive") {
            return reply.status(401).send({
                error: true,
                message: "Funcionário inativo",
                code: "EMPLOYEE_INACTIVE"
            })
        }

        // Database connection errors often manifest as codes
        if (err.code === 'P1001' || err.code === 'P1002' || err.code === 'P1008') { // Prisma connection errors
            return reply.status(503).send({
                error: true,
                message: "Serviço indisponível (banco de dados)",
                code: "DB_CONNECTION_ERROR"
            })
        }

        return reply.status(500).send({
            error: true,
            message: "Erro interno do servidor",
            code: "INTERNAL_SERVER_ERROR"
        })
    }
}

export async function register(request: FastifyRequest, reply: FastifyReply) {
    const registerBodySchema = z.object({
        pin: z.string(),
        action: z.enum(["clockIn", "breakStart", "breakEnd", "clockOut", "extraClockIn", "extraClockOut"]),
        timestamp: z.string().optional(),
    })

    const { pin, action, timestamp } = registerBodySchema.parse(request.body)

    const registerTimeClockUseCase = new RegisterTimeClockUseCase(
        employeesRepository,
        timeClocksRepository
    )

    try {
        const { employee, timestamp: savedTimestamp } = await registerTimeClockUseCase.execute({
            pin,
            action,
            timestamp,
        })

        return reply.status(201).send({
            employee,
            action,
            timestamp: savedTimestamp,
        })
    } catch (err: any) {
        console.error("POST /time-clock/register Error:", err)

        if (err.message === "Employee not found") {
            return reply.status(404).send({
                error: true,
                message: "Funcionário não encontrado para registro",
                code: "EMPLOYEE_NOT_FOUND"
            })
        }

        // Database/Prisma errors
        if (err.code && err.code.startsWith('P')) {
            return reply.status(503).send({
                error: true,
                message: "Serviço indisponível (banco de dados)",
                code: "DB_CONNECTION_ERROR"
            })
        }

        return reply.status(500).send({
            error: true,
            message: "Erro ao registrar ponto",
            code: "INTERNAL_SERVER_ERROR"
        })
    }
}

export async function syncOffline(request: FastifyRequest, reply: FastifyReply) {
    const syncOfflineBodySchema = z.object({
        punches: z.array(z.object({
            pin: z.string(),
            action: z.enum(["clockIn", "breakStart", "breakEnd", "clockOut", "extraClockIn", "extraClockOut"]),
            timestamp: z.string()
        }))
    })

    const { punches } = syncOfflineBodySchema.parse(request.body)

    const registerTimeClockUseCase = new RegisterTimeClockUseCase(
        employeesRepository,
        timeClocksRepository
    )

    const results = []
    const errors = []

    for (const punch of punches) {
        try {
            const { employee, timestamp: savedTimestamp } = await registerTimeClockUseCase.execute({
                pin: punch.pin,
                action: punch.action,
                timestamp: punch.timestamp,
                isOffline: true
            })
            results.push({
                pin: punch.pin,
                action: punch.action,
                timestamp: savedTimestamp,
                success: true
            })
        } catch (err: any) {
            console.error(`Error registering offline punch for PIN ${punch.pin}:`, err)
            errors.push({
                pin: punch.pin,
                action: punch.action,
                timestamp: punch.timestamp,
                error: err.message || "Erro desconhecido"
            })
        }
    }

    return reply.status(200).send({
        success: true,
        syncedCount: results.length,
        failedCount: errors.length,
        results,
        errors
    })
}
