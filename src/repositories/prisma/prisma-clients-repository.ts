import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { ClientsRepository } from '../clients-repository'


export class PrismaClientsRepository implements ClientsRepository{
    findByName(name: string): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[] | null> {
        throw new Error('Method not implemented.')
    }
    async findMany(is_contract?: boolean | undefined): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[] | null> {
        const clients = await prisma.client.findMany({
            include: {
                equipments: true,
                addresses: true
            }
        })
        return clients
    }
    update(data: Prisma.ClientUpdateInput): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[]> {
        throw new Error('Method not implemented.')
    }
    delete(id: string): void {
        throw new Error('Method not implemented.')
    }
    async findById(id: string) {
        const client = await prisma.client.findUnique({
            where: {
                id
            }
        })
        return client
    }
    async create(data: Prisma.ClientCreateInput) {

        const client = await prisma.client.create({
            data
        })
        return client
    }
}
