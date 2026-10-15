import { FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { GetEmployeeTimeClockStatusUseCase } from "../../use-cases/get-time-clock-status"
import { RecusaDaBatida, RegisterTimeClockUseCase } from "../../use-cases/register-time-clock"
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
    // Fase 4 do Mergulho (01:R11): o PIN não vai mais para o registro do servidor (antes saía inteiro a cada consulta).

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

        // Fase 3/4 do Mergulho (01:R1, 01:R4, 01:R8): recusa de regra responde com o motivo. Inativo = 401 (igual à consulta
        // do PIN); casa já preenchida ou fora da ordem = 409. Antes era 500 genérico e o Ponto mostrava "salvo sem internet".
        // O Ponto antigo trata qualquer resposta que não seja 2xx do mesmo jeito de antes.
        if (err instanceof RecusaDaBatida) {
            return reply.status(err.codigo === "EMPLOYEE_INACTIVE" ? 401 : 409).send({
                error: true,
                message: err.mensagem,
                code: err.codigo
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
            // Número da batida no computador do Ponto (Ponto novo): volta na resposta para ele saber qual entrou e qual não
            id: z.union([z.number(), z.string()]).optional(),
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
            const resultado = await registerTimeClockUseCase.execute({
                pin: punch.pin,
                action: punch.action,
                timestamp: punch.timestamp,
                isOffline: true
            })
            results.push({
                ...(punch.id !== undefined ? { id: punch.id } : {}),
                pin: punch.pin,
                action: punch.action,
                timestamp: resultado.timestamp,
                success: true,
                ...("aviso" in resultado && resultado.aviso ? { aviso: resultado.aviso } : {})
            })
        } catch (err: any) {
            // Recusa de regra (inativo, casa já preenchida, sem a Entrada) é definitiva: reenviar não muda nada.
            // Erro do banco é passageiro: o Ponto tem de tentar de novo.
            const permanente = err instanceof RecusaDaBatida
            console.error(`Batida da fila recusada (${punch.action}, ${punch.timestamp}): ${err?.message}`)
            errors.push({
                ...(punch.id !== undefined ? { id: punch.id } : {}),
                pin: punch.pin,
                action: punch.action,
                timestamp: punch.timestamp,
                error: err.message || "Erro desconhecido",
                code: permanente ? err.codigo : "TRANSIENT_ERROR",
                mensagem: permanente ? err.mensagem : "Falha passageira na nuvem: o Ponto tenta de novo",
                permanente
            })
        }
    }

    // Fase 3 do Mergulho (01:R3): antes respondia sempre 200 e o Ponto marcava todas como enviadas, inclusive as que deram erro.
    // Agora: falha passageira (banco fora) = 503, e o Ponto (antigo e novo) guarda TODAS para reenviar (as que já entraram
    // voltam como repetição e não duplicam). Só recusas definitivas = 200 com a lista de erros, que o Ponto novo lê e guarda.
    const temFalhaPassageira = errors.some((e) => !e.permanente)

    return reply.status(temFalhaPassageira ? 503 : 200).send({
        success: !temFalhaPassageira,
        syncedCount: results.length,
        failedCount: errors.length,
        results,
        errors
    })
}
