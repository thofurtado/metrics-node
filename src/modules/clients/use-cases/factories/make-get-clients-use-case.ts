import { PrismaClientsRepository } from '@/modules/clients/repositories/prisma/prisma-clients-repository'
import { GetClientsUseCase } from '@/modules/clients/use-cases/get-clients'

export function MakeGetClientsUseCase() {
    const clientsRepository = new PrismaClientsRepository()
    const getClientUseCase = new GetClientsUseCase(clientsRepository)
    return getClientUseCase
}
