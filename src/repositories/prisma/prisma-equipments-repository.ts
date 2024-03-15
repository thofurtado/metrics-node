import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { EquipmentsRepository } from '../equipments-repository'


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
    findByClient(client_id: string): Promise<{ id: string; client_id: string; type: string; brand: string | null; identification: string | null; details: string | null; entry: Date }[] | null> {
        const equiepments = prisma.equipment.findMany({
            where: {
                client_id
            }
        })
        return equiepments
    }
    findMany(type?: string | undefined, brand?: string | undefined, identification?: string | undefined): Promise<{ id: string; client_id: string; type: string; brand: string | null; identification: string | null; details: string | null; entry: Date }[] | null> {
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
