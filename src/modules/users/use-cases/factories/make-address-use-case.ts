import { PrismaAddressesRepository } from '@/modules/users/repositories/prisma/prisma-addresses-repository'
import { AddressUseCase } from '@/modules/users/use-cases/address'
import { PrismaClientsRepository } from '@/modules/clients/repositories/prisma/prisma-clients-repository'




export function MakeAddressuseCase() {
    const addressesRepository = new PrismaAddressesRepository()
    const clientsRepository = new PrismaClientsRepository()
    const addressUseCase = new AddressUseCase(addressesRepository, clientsRepository)
    return addressUseCase
}
