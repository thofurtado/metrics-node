import { MakeChangeTransactionStatusUseCase } from '@/use-cases/factories/make-change-transaction-status'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export async function changeTransactionStatus(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    // 1. Schema para validar os Parâmetros da Rota (ID)
    const switchTransactionParamsSchema = z.object({
        id: z.string().uuid(),
    })

    // 2. Schema para validar o Corpo da Requisição (Payload de Atualização)
    const switchTransactionBodySchema = z.object({
        amount: z.number().positive(),
        date: z.string().or(z.date()).transform((val) => new Date(val)), // Data de liquidação

        // NOVO: remainingDate é opcional e deve ser uma data
        remainingDate: z
            .string()
            .or(z.date())
            .transform((val) => new Date(val))
            .optional(),
    })

    // Valida e extrai o ID dos parâmetros da rota (URL)
    const { id } = switchTransactionParamsSchema.parse(request.params)

    // Valida e extrai os dados do corpo da requisição (Body)
    const { amount, date, remainingDate } = switchTransactionBodySchema.parse(
        request.body,
    )

    try {
        const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase()
        

        // Executa a lógica de negócio, passando todos os dados, incluindo o remainingDate (se existir)
        await changeTransactionStatusUseCase.execute({
            id,
            amount, // Valor pago (parcial ou total)
            date, // Data de confirmação/pagamento
            remainingDate, // Passa a nova data de vencimento da parcela restante (opcional)
        })

        // Retorno de Sucesso (200 OK sem conteúdo)
        return reply.status(200).send()
    } catch (err) {
        // Tratamento de Erro de validação do Zod
        if (err instanceof z.ZodError) {
            return reply
                .status(400)
                .send({ message: 'Validation error.', issues: err.format() })
        }

        // Tratamento de Erro de lógica de negócio
        if (err instanceof Error) {
            // Se você estiver usando o ResourceNotFoundError, esta é a forma de tratá-lo:
            if (err.message.includes('Resource not found')) {
                return reply.status(404).send({ message: 'Transaction not found.' })
            }
            // Outros erros de lógica de negócio
            return reply.status(400).send({ message: err.message })
        }

        // Erro inesperado no servidor
        console.error(err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}