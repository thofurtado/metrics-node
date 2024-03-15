import { ClientsRepository } from '@/repositories/clients-repository'
import { Client } from '@prisma/client'


interface GetClientsUseCaseResponse {
    clients: Client[] | null
}
export class GetClientsUseCase {

    constructor(
        private clientsRepository: ClientsRepository
    ) { }
    async execute(): Promise<GetClientsUseCaseResponse> {

        const clients = await this.clientsRepository.findMany()


        return {
            clients
        }
    }
}

