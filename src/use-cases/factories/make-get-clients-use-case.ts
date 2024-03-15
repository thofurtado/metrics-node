import { PrismaClientsRepository } from '@/repositories/prisma/prisma-clients-repository'
import { GetClientsUseCase } from '../get-clients'

export function MakeGetClientsUseCase() {
    const clientsRepository = new PrismaClientsRepository()
    const getClientUseCase = new GetClientsUseCase(clientsRepository)
    return getClientUseCase
}
