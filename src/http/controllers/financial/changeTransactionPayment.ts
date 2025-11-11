import { MakeChangeTransactionStatusUseCase } from '@/use-cases/factories/make-change-transaction-status'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export async function changeTransactionStatus(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    // 1. Schema Renomeado para validar os Parâmetros da Rota
    const switchTransactionParamsSchema = z.object({
        id: z.string().uuid(),
    })

    // Valida e extrai o ID dos parâmetros da rota (URL)
    const { id } = switchTransactionParamsSchema.parse(request.params)

    try {
        const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase()
        console.log('iniciando use case')
        // Executa a lógica de negócio para alterar o status da transação
        await changeTransactionStatusUseCase.execute({
            id,
        })

        // Retorno de Sucesso (200 OK sem conteúdo, pois é um PATCH sem retorno de dados)
        return reply.status(200).send()
    } catch (err) {
        // 2. Tratamento de Erro mais robusto
        if (err instanceof Error) {
            // Se o Use Case lançar um erro informando que a transação não foi encontrada
            if (err.message.includes('Transaction not found')) {
                return reply.status(404).send({ message: err.message })
            }
            // Outros erros de lógica de negócio ou de validação
            return reply.status(400).send({ message: err.message })
        }

        // Erro inesperado no servidor
        console.error(err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}