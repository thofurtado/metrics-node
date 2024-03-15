import { AddressesRepository } from '@/repositories/addresses-repository'
import { ClientsRepository } from '@/repositories/clients-repository'
import { Address } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
interface AddressUseCaseRequest {
    street: string;
    number: number;
    neighborhood: string;
    city: string;
    state: string;
    zipcode: number;
    client_id: string;
}

interface AddressUseCaseResponse {
    address: Address
}
export class AddressUseCase {

    constructor(
        private addressRepository: AddressesRepository,
        private clientsRepository: ClientsRepository
    ) { }
    async execute({
        street, number, neighborhood, city, state, zipcode, client_id
    }: AddressUseCaseRequest): Promise<AddressUseCaseResponse> {

        const client = await this.clientsRepository.findById(client_id)

        if(!client) {
            throw new ResourceNotFoundError()
        }

        const address = await this.addressRepository.create({
            street,
            number,
            neighborhood,
            city,
            state,
            zipcode,
            client_id
        })
        return {
            address
        }
    }
}

