import { MakeDeleteTransactionUseCase } from '@/use-cases/factories/make-delete-transaction'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function deleteTransaction(request: FastifyRequest, reply: FastifyReply) {

    const deleteItemTreatmentParamsSchema = z.object({
        id:z.string().uuid()
    })

    const { id } = deleteItemTreatmentParamsSchema.parse(request.params)
    console.log(id)
    try {

        const deleteTransactionUseCase = MakeDeleteTransactionUseCase()

        await deleteTransactionUseCase.execute({
            id
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(204).send()
}


