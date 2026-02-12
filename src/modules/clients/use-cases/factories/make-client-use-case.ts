import { PrismaClientsRepository } from '@/modules/clients/repositories/prisma/prisma-clients-repository'
import { ClientUseCase } from '@/modules/clients/use-cases/client'




export function MakeClientuseCase() {
    const clientsRepository = new PrismaClientsRepository()
    const clientUseCase = new ClientUseCase(clientsRepository)
    return clientUseCase
}
