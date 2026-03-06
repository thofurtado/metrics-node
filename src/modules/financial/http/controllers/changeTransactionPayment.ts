import { MakeChangeTransactionStatusUseCase } from '@/modules/financial/use-cases/factories/make-change-transaction-status'
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
        data_vencimento: z.string().or(z.date()).transform((val) => new Date(val)).optional(), // Data de liquidação
        date: z.string().or(z.date()).transform((val) => new Date(val)).optional(), // backward compat

        // NOVO: remainingDate é opcional e deve ser uma data
        remainingDate: z
            .string()
            .or(z.date())
            .transform((val) => new Date(val))
            .optional(),

        // NOVO: Permitir trocar a conta na hora do pagamento
        account_id: z.string().uuid().optional(),
    })

    // Valida e extrai o ID dos parâmetros da rota (URL)
    const { id } = switchTransactionParamsSchema.parse(request.params)


    // Valida e extrai os dados do corpo da requisição (Body)
    const { amount, date: rawDate, data_vencimento: rawDv, remainingDate, account_id } = switchTransactionBodySchema.parse(
        request.body,
    )
    const date = rawDv || rawDate || new Date()
    console.log({ amount, date, remainingDate, account_id })
    try {
        const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase()


        // Executa a lógica de negócio, passando todos os dados, incluindo o remainingDate (se existir)
        await changeTransactionStatusUseCase.execute({
            id,
            amount, // Valor pago (parcial ou total)
            date, // Data de confirmação/pagamento
            remainingDate, // Passa a nova data de vencimento da parcela restante (opcional)
            account_id, // Conta selecionada (opcional)
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