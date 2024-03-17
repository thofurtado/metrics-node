import { MakeEquipmentuseCase } from '@/use-cases/factories/make-equipment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createEquipment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        client_id:      z.string(),
        type:           z.string(),
        brand:          z.string().nullish(),
        identification: z.string().nullish(),
        details:        z.string().nullish(),
        entry:          z.date().nullish()
    })

    const { client_id, type, brand, identification, details, entry } = registerBodySchema.parse(request.body)
    let equipment
    try {

        const equipmentUseCase = MakeEquipmentuseCase()

        equipment = await equipmentUseCase.execute({
            client_id,
            type,
            brand: brand ? brand : undefined,
            identification: identification ? identification : undefined,
            details: details ? details : undefined,
            entry: entry ? entry : new Date(' GMT-3')
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(equipment)
}


