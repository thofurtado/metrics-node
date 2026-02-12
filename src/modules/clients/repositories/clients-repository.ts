import {Prisma, Client} from '@prisma/client'

export interface ClientsRepository {
    create(data: Prisma.ClientCreateInput):Promise<Client>
    findById(id:string): Promise<Client | null>
    findByName(name:string): Promise<Client[] | null>
    findMany(is_contract?:boolean):Promise<Client[] | null>
    update(data: Prisma.ClientUpdateInput):Promise<Client[]>
    delete(id:string):void //only can be deleted if there is no other relation with this client
}
