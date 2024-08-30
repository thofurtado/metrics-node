import { ClientsRepository } from '@/repositories/clients-repository'
import { Client } from '@prisma/client'
interface ClientUseCaseRequest {
    name: string
    email?: string
    identification?: string,
    phone?: string,
    contract?: boolean,
}

interface ClientUseCaseResponse {
    client: Client
}
export class ClientUseCase {

    constructor(
        private clientsRepository: ClientsRepository
    ) { }
    async execute({
        name, email, identification, phone, contract
    }: ClientUseCaseRequest): Promise<ClientUseCaseResponse> {

        const client = await this.clientsRepository.create({
            name,
            email,
            identification,
            phone,
            contract
        })
        return {
            client
        }
    }
}

