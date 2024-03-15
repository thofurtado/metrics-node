import { prisma } from '@/lib/prisma'
import { Address, Prisma } from '@prisma/client'
import { AddressesRepository } from '../addresses-repository'


export class PrismaAddressesRepository implements AddressesRepository{
    update(data: Prisma.AddressUncheckedUpdateInput): Promise<{ id: string; client_id: string; street: string; number: number; neighborhood: string; city: string; state: string; zipcode: number | null }> {
        throw new Error('Method not implemented.')
    }
    async findByDetails(neighborhood?: string | undefined, city?: string | undefined): Promise<{ id: string; client_id: string; street: string; number: number; neighborhood: string; city: string; state: string; zipcode: number | null }[] | null> {
        throw new Error('Method not implemented.')
    }
    async findByClientId(client_id: string):Promise<Address[] | null> {
        const address = await prisma.address.findMany({
            where: {
                client_id
            }
        })
        return address
    }
    async create(data: Prisma.AddressUncheckedCreateInput) {

        const address = await prisma.address.create({
            data
        })
        return address
    }
}
