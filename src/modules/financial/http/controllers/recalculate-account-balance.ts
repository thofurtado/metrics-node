import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { RecalculateAccountBalanceUseCase, RecalculoBloqueadoError } from '@/modules/financial/use-cases/recalculate-account-balance'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function recalculateAccountBalance(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    const accountsRepository = new PrismaAccountsRepository()
    const recalculateUseCase = new RecalculateAccountBalanceUseCase(accountsRepository)

    try {
        const { account } = await recalculateUseCase.execute({ id })
        return reply.status(200).send(account)
    } catch (error) {
        if (error instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: error.message })
        }
        // Mergulho 13:D1: conta com acerto manual não é recalculada (o recálculo apagaria o acerto)
        if (error instanceof RecalculoBloqueadoError) {
            return reply.status(409).send({ code: 'RECALCULO_BLOQUEADO', message: error.message })
        }
        throw error
    }
}

// Prévia do recálculo (Fase 1 do Mergulho, 13:D1): devolve o saldo de hoje e o que o recálculo gravaria, sem gravar.
// Rota separada de propósito: a tela nova pede a prévia antes; se a nuvem ainda for a antiga, a prévia dá 404 e a tela
// não recalcula nada.
export async function previewRecalculateAccountBalance(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    const recalculateUseCase = new RecalculateAccountBalanceUseCase(new PrismaAccountsRepository())

    try {
        const { saldoAtual, saldoNovo, motivoBloqueio } = await recalculateUseCase.execute({ id, simular: true })
        return reply.status(200).send({ saldo_atual: saldoAtual, saldo_novo: saldoNovo, bloqueado: motivoBloqueio ?? null })
    } catch (error) {
        if (error instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: error.message })
        }
        throw error
    }
}
