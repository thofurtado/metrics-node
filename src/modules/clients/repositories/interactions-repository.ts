import { Interaction, Prisma } from '@prisma/client'

export interface InteractionsRepository {
    create(data: Prisma.InteractionUncheckedCreateInput):Promise<Interaction>
    update(data: Prisma.InteractionUncheckedUpdateInput):Promise<Interaction>
    delete(id:string):Promise<void>
    findByTreatment(treatment_id:string):Promise<Interaction[] | null>
}

