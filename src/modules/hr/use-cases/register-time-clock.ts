import { PrismaEmployeesRepository } from "../repositories/prisma/prisma-employees-repository"
import { PrismaTimeClocksRepository } from "../repositories/prisma/prisma-time-clocks-repository"
import { getCompetenceDate } from "../../../utils/get-competence-date"

interface Request {
    pin: string
    action: "clockIn" | "breakStart" | "breakEnd" | "clockOut" | "extraClockIn" | "extraClockOut"
    timestamp?: string
    isAdmin?: boolean // Zero Trust: Flag to allow manual timestamp override from HR panel
    isOffline?: boolean // Confirmed kiosk offline sync flag
}

type Casa = Request["action"]

/**
 * Recusa de regra ao gravar a batida (Mergulho 01:R8 e 01:R3): o controlador responde com o código e o motivo em português,
 * em vez do 500 genérico que o Ponto confundia com "sem internet". A `message` em inglês continua a mesma de antes (registro
 * do servidor e comparações antigas).
 */
export class RecusaDaBatida extends Error {
    constructor(message: string, public codigo: string, public mensagem: string) {
        super(message)
        this.name = "RecusaDaBatida"
    }
}

const NOME_DA_CASA: Record<Casa, string> = {
    clockIn: "Entrada",
    breakStart: "Saída para o intervalo",
    breakEnd: "Volta do intervalo",
    clockOut: "Saída",
    extraClockIn: "Entrada extra",
    extraClockOut: "Saída extra",
}

/** Hora em Brasília (UTC-3, sem horário de verão desde 2019), só HH:MM, para as mensagens */
function hhmm(d: Date): string {
    return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

/**
 * Na fila do Ponto, a mesma batida pode voltar com hora um pouco diferente: a gravação com internet usou a hora da nuvem,
 * a resposta se perdeu (8 s de espera) e a fila reenviou com a hora do computador. Até 5 minutos de diferença = mesma batida.
 */
const TOLERANCIA_MESMA_BATIDA_NA_FILA_MS = 5 * 60 * 1000

/** A casa que tem de estar preenchida antes desta (mesma ordem que a nuvem confere com internet) */
function faltaAntes(action: Casa, t: Record<string, Date | null | undefined>): Casa | null {
    if (action === "breakStart" && !t.clockIn) return "clockIn"
    if (action === "breakEnd" && !t.breakStart) return "breakStart"
    if (action === "clockOut" && !t.clockIn) return "clockIn"
    if (action === "extraClockIn" && !t.clockOut) return "clockOut"
    if (action === "extraClockOut" && !t.extraClockIn) return "extraClockIn"
    return null
}

const MENSAGEM_EM_INGLES: Record<Casa, string> = {
    clockIn: "Must clock in first",
    breakStart: "Must clock in before break",
    breakEnd: "Must start break before ending it",
    clockOut: "Must clock in before clock out",
    extraClockIn: "Must do standard clock out before doing an extra shift",
    extraClockOut: "Must start extra shift before clicking extra shift checkout",
}

export class RegisterTimeClockUseCase {
    constructor(
        private employeesRepository: PrismaEmployeesRepository,
        private timeClocksRepository: PrismaTimeClocksRepository
    ) { }

    async execute({ pin, action, timestamp, isAdmin = false, isOffline = false }: Request) {
        const employee = await this.employeesRepository.findByPin(pin)

        if (!employee) {
            throw new RecusaDaBatida("Employee not found", "EMPLOYEE_NOT_FOUND", "Funcionário não encontrado")
        }

        // Fase 3 do Mergulho (01:R1): a consulta do PIN já recusava o inativo, mas a gravação não conferia. Agora as duas
        // recusam, com internet e na fila (o Ponto novo guarda a recusada com o motivo, em vez de perder).
        if (!employee.isRegistered) {
            throw new RecusaDaBatida("Employee inactive", "EMPLOYEE_INACTIVE", "Funcionário inativo: procure o RH")
        }

        // ZERO TRUST LOGIC:
        // By default, we ignore the client-sent timestamp to prevent fraud or clock drift issues.
        // We trust the client timestamp if the request is an admin override OR authenticated kiosk offline sync.
        const now = ((isAdmin || isOffline) && timestamp) ? new Date(timestamp) : new Date()
        if (Number.isNaN(now.getTime())) {
            throw new RecusaDaBatida("Invalid timestamp", "INVALID_TIMESTAMP", "Hora da batida inválida")
        }

        const competenceDate = getCompetenceDate(now)

        let timeClock = await this.timeClocksRepository.findByEmployeeAndDate(employee.id, competenceDate)

        // Aviso devolvido ao Ponto quando a fila grava fora da ordem (01:R7): a batida entra (não se perde hora real),
        // mas o Ponto fica sabendo.
        let aviso: string | undefined

        if (!timeClock) {
            if (action !== "clockIn") {
                throw new RecusaDaBatida(
                    MENSAGEM_EM_INGLES.clockIn,
                    "OUT_OF_ORDER",
                    `${NOME_DA_CASA[action]} sem a Entrada do dia: registre a Entrada antes`
                )
            }

            timeClock = await this.timeClocksRepository.create({
                employee_id: employee.id,
                date: competenceDate,
                clockIn: now,
            })
        } else {
            // Record exists.
            const existingValue = timeClock[action]

            if (existingValue) {
                const diff = Math.abs(existingValue.getTime() - now.getTime())
                // Repetição da mesma batida: com internet, toque duplo (2 s); na fila, reenvio da mesma batida (5 min).
                // Devolve sucesso com a hora que já estava, para a fila andar.
                if (diff < 2000 || (isOffline && diff < TOLERANCIA_MESMA_BATIDA_NA_FILA_MS)) {
                    return {
                        employee: {
                            name: employee.name,
                        },
                        action,
                        timestamp: existingValue, // Return the originally saved timestamp
                    }
                }

                // Fase 4 do Mergulho (01:R4): casa já preenchida com OUTRA hora. A hora que estava continua valendo (igual
                // antes), mas agora a resposta diz isso: com internet vira 409 com o motivo (era 500 genérico) e, na fila,
                // vai para a lista de recusadas (antes respondia "ok" e a batida sumia sem aviso).
                throw new RecusaDaBatida(
                    `Action ${action} already recorded at ${existingValue.toISOString()}`,
                    "ALREADY_RECORDED",
                    isOffline
                        ? `${NOME_DA_CASA[action]} já tinha ${hhmm(existingValue)}; a batida das ${hhmm(now)} (sem internet) não entrou`
                        : `${NOME_DA_CASA[action]} já registrada hoje às ${hhmm(existingValue)}`
                )
            }

            // Basic validation flow
            const falta = faltaAntes(action, timeClock as any)
            if (falta) {
                if (!isOffline) {
                    throw new RecusaDaBatida(
                        MENSAGEM_EM_INGLES[action],
                        "OUT_OF_ORDER",
                        `${NOME_DA_CASA[action]} antes da ${NOME_DA_CASA[falta]}: registre a ${NOME_DA_CASA[falta]} antes`
                    )
                }
                // Na fila a ordem continua solta de propósito (36d9598, 10/07/2026): a batida aconteceu e não pode se perder.
                aviso = `${NOME_DA_CASA[action]} gravada sem a ${NOME_DA_CASA[falta]} (fora da ordem): conferir no espelho`
            }

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
            ...(aviso ? { aviso } : {}),
        }
    }
}
