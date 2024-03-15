import { Client, Prisma } from '@prisma/client'
import { ClientsRepository } from '../clients-repository'
import { randomUUID } from 'node:crypto'

export class InMemoryClientsRepository implements ClientsRepository {


    public items: Client[] = []
    async findByName(name: string): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[] | null> {
        const clients = this.items.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()))
        return clients.length ? clients : null
    }
    async findMany(is_contract?: boolean | undefined): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[] | null> {
        let filteredClients = this.items.slice() // Create a copy to avoid modifying original array

        if (is_contract !== undefined) {
            filteredClients = filteredClients.filter((item) => item.contract === is_contract)
        }

        return filteredClients.length ? filteredClients : null
    }
    async update(data: Prisma.ClientUpdateInput): Promise<{ id: string; name: string; identification: string; phone: string | null; email: string; contract: boolean }[]> {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Client with ID ${id} not found`)
        }
    }
    async findById(id: string) {
        const client = this.items.find(item => item.id === id)

        if (!client) {
            return null
        }
        return client
    }
    async findByEmail(email: string) {
        const client = this.items.find(item => item.email === email)

        if (!client) {
            return null
        }
        return client
    }
    async create(data: Prisma.ClientCreateInput) {
        const client = {
            id: randomUUID(),
            name: data.name,
            email: data.email,
            identification: data.identification,
            phone: data.phone ?? null,
            contract: data.contract ?? false,
        }
        this.items.push(client)
        return client
    }
}
