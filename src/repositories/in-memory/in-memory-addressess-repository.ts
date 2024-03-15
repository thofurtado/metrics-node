import {Address, Prisma} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { AddressesRepository } from '../addresses-repository'

export class InMemoryAddressessRepository implements AddressesRepository {

    public items: Address[] = []
    async update(data: Prisma.AddressUncheckedUpdateInput): Promise<{ id: string; client_id: string; street: string; number: number; neighborhood: string; city: string; state: string; zipcode: number | null }> {
        throw new Error('Method not implemented.')
    }
    async findByClient(client_id: string): Promise<{ id: string; client_id: string; street: string; number: number; neighborhood: string; city: string; state: string; zipcode: number | null }[] | null> {
        const addresses = this.items.filter((item) => item.client_id === client_id)
        return addresses.length ? addresses : null
    }
    async findByDetails(neighborhood?: string | undefined, city?: string | undefined): Promise<{ id: string; client_id: string; street: string; number: number; neighborhood: string; city: string; state: string; zipcode: number | null }[] | null> {
        let filteredAddresses = this.items.slice() // Create a copy to avoid modifying original array

        if (neighborhood) {
            filteredAddresses = filteredAddresses.filter((item) => item.neighborhood === neighborhood)
        }

        if (city) {
            filteredAddresses = filteredAddresses.filter((item) => item.city === city)
        }

        return filteredAddresses.length ? filteredAddresses : null
    }

    async findByClientId(client_id: string){
        const address = this.items.find(item => item.client_id === client_id)

        if(!address){
            return null
        }
        return address
    }
    async create(data: Prisma.AddressUncheckedCreateInput){
        const address = {
            id: randomUUID(),
            street: data.street,
            number: data.number,
            neighborhood: data.neighborhood,
            city: data.city,
            state: data.state,
            zipcode: data.zipcode ?? null,
            client_id: data.client_id
        }
        this.items.push(address)
        return address
    }
}
