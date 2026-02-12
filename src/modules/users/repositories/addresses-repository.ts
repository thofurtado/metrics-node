import {Prisma, Address} from '@prisma/client'

export interface AddressesRepository {
    create(data: Prisma.AddressUncheckedCreateInput):Promise<Address>
    update(data: Prisma.AddressUncheckedUpdateInput):Promise<Address>
    findByClientId(client_id:string): Promise<Address[] | null>
    // for now do a find first, when i make a main address ill alter
    findByDetails(neighborhood?:string, city?:string):Promise<Address[] | null>
}
