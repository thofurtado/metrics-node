import { prisma } from '@/lib/prisma'
import { Prisma, Equipment } from '@prisma/client'
import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'


export class PrismaEquipmentsRepository implements EquipmentsRepository {

    async findById(id: string) {
        const equipment = await prisma.equipment.findUnique({
            where: { id }
        })
        return equipment
    }
    async findByClientId(client_id: string) {
        const equipment = await prisma.equipment.findMany({
            where: { client_id }
        })
        return equipment
    }
    async create(data: Prisma.EquipmentUncheckedCreateInput) {

        const equipment = await prisma.equipment.create({
            data
        })
        return equipment
    }
    findByClient(client_id: string): Promise<Equipment[] | null> {
        const equiepments = prisma.equipment.findMany({
            where: {
                client_id
            }
        })
        return equiepments
    }
    findMany(type?: string | undefined, brand?: string | undefined, identification?: string | undefined): Promise<Equipment[] | null> {
        const equiepments = prisma.equipment.findMany({
            where: {
                type,
                brand,
                identification
            }
        })
        return equiepments
    }
}
