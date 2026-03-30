import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ExtractTransactionDataUseCase } from '@/modules/financial/use-cases/extract-transaction-data'

export async function extractTransactionData(request: FastifyRequest, reply: FastifyReply) {
  const extractBodySchema = z.object({
    code: z.string(),
  })

  const { code } = extractBodySchema.parse(request.body)

  try {
    const extractTransactionDataUseCase = new ExtractTransactionDataUseCase()
    const result = await extractTransactionDataUseCase.execute({ code })

    return reply.status(200).send(result)
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message })
    }

    throw err
  }
}
