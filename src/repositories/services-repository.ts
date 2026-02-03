import { Prisma, Service } from '@prisma/client'

export interface ServicesRepository {
    create(data: Prisma.ServiceCreateInput): Promise<Service>
    findById(id: string): Promise<Service | null>
    findByName(name: string): Promise<Service | null>
    findByDisplayId(displayId: number): Promise<Service | null>
    findMany(page: number, perPage: number, query?: string, active?: boolean): Promise<{ services: Service[], count: number }>
    save(service: Service): Promise<Service>
    delete(id: string): Promise<void>
    findNextAvailableDisplayId(): Promise<number>
}
