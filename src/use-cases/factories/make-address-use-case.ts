import { PrismaAddressesRepository } from '@/repositories/prisma/prisma-addresses-repository'
import { AddressUseCase } from '../address'
import { PrismaClientsRepository } from '@/repositories/prisma/prisma-clients-repository'




export function MakeAddressuseCase() {
    const addressesRepository = new PrismaAddressesRepository()
    const clientsRepository = new PrismaClientsRepository()
    const addressUseCase = new AddressUseCase(addressesRepository, clientsRepository)
    return addressUseCase
}
