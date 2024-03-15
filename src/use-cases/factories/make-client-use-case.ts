import { PrismaClientsRepository } from '@/repositories/prisma/prisma-clients-repository'
import { ClientUseCase } from '../client'




export function MakeClientuseCase() {
    const clientsRepository = new PrismaClientsRepository()
    const clientUseCase = new ClientUseCase(clientsRepository)
    return clientUseCase
}
