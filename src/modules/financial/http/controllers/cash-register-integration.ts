import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeTransactionUseCase } from '@/modules/financial/use-cases/factories/make-transaction-use-case'
import { env } from '@/env'
import { prisma } from '@/lib/prisma'

export async function cashRegisterIntegration(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    // 1. Validar API Key
    const apiKey = request.headers['x-api-key']
    if (!apiKey || apiKey !== env.INTEGRATION_API_KEY) {
        return reply.status(401).send({ message: 'Unauthorized: Invalid API Key' })
    }

    // 2. Schema de validação do payload
    const bodySchema = z.object({
        date: z.string(), // "2026-04-17"
        period: z.string(), // "Almoço" ou "Jantar"
        totalAmount: z.number().positive(),
        account_id: z.string().uuid(),
        sector_id: z.string().uuid().optional(),
        description: z.string().optional(),
    })

    try {
        const { date, period, totalAmount, account_id, sector_id, description } = bodySchema.parse(request.body)

        // 3. Montar a descrição automaticamente se não fornecida
        const [yyyy, mm, dd] = date.split('-')
        const formattedDate = `${dd}/${mm}/${yyyy}`
        const finalDescription = description || `Caixa ${period} - ${formattedDate}`

        // 4. Montar a data de vencimento (data do caixa)
        const dataVencimento = new Date(`${date}T12:00:00.000Z`)

        // 5. Verificar se já existe uma transação com o mesmo método 'CAIXA' e mesma descrição para esta conta
        const existingTransaction = await prisma.transaction.findFirst({
            where: {
                payment_method: 'CAIXA',
                account_id,
                description: finalDescription,
            }
        })

        if (existingTransaction) {
            const updatedTransaction = await prisma.transaction.update({
                where: { id: existingTransaction.id },
                data: {
                    amount: totalAmount,
                    totalValue: totalAmount,
                }
            })

            // Ajusta o saldo da conta com a diferença de valores se a transação estiver confirmada
            if (existingTransaction.confirmed) {
                const diff = totalAmount - existingTransaction.amount
                if (diff !== 0) {
                    await prisma.account.update({
                        where: { id: account_id },
                        data: {
                            balance: {
                                increment: diff
                            }
                        }
                    })
                }
            }

            return reply.status(200).send({
                message: 'Entrada de caixa atualizada com sucesso',
                transaction: updatedTransaction
            })
        }

        // 6. Criar a transação via use case existente se não existir anterior
        const transactionUseCase = MakeTransactionUseCase()

        const result = await transactionUseCase.execute({
            operation: 'income',
            amount: totalAmount,
            account_id,
            confirmed: true,
            data_vencimento: dataVencimento,
            data_emissao: dataVencimento,
            sector_id: sector_id || null,
            description: finalDescription,
            destination_account_id: null,
            supplier_id: null,
            payment_method: 'CAIXA',
            totalValue: totalAmount,
        })

        return reply.status(201).send({
            message: 'Entrada de caixa registrada com sucesso',
            transaction: result.transaction
        })
    } catch (err) {
        if (err instanceof z.ZodError) {
            return reply.status(400).send({ message: 'Validation error.', issues: err.format() })
        }

        if (err instanceof Error) {
            console.error('Erro na integração do caixa:', err)
            return reply.status(400).send({ message: err.message })
        }

        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
