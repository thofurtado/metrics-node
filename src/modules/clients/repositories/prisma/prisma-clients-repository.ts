import { prisma } from '@/lib/prisma'
import { Prisma, Client } from '@prisma/client'
import { ClientsRepository } from '@/modules/clients/repositories/clients-repository'


export class PrismaClientsRepository implements ClientsRepository {
    async findByName(name: string): Promise<Client[] | null> {
        throw new Error('Method not implemented.')
    }
    async findMany(is_contract?: boolean | undefined): Promise<Client[] | null> {
        const clients = await prisma.client.findMany({
            include: {
                equipments: true,
                addresses: true
            },
            orderBy: [
                {
                    name: 'asc'
                }
            ]
        })
        return clients
    }
    async update(data: Prisma.ClientUpdateInput): Promise<Client[]> {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
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
