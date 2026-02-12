import { prisma } from '@/lib/prisma'
import { Prisma, Service } from '@prisma/client'
import { ServicesRepository } from '@/modules/services/repositories/services-repository'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

export class PrismaServicesRepository implements ServicesRepository {
    async create(data: Prisma.ServiceCreateInput): Promise<Service> {
        return await prisma.service.create({
            data,
        })
    }

    async findById(id: string): Promise<Service | null> {
        return await prisma.service.findUnique({
            where: { id },
        })
    }

    async findByName(name: string): Promise<Service | null> {
        return await prisma.service.findFirst({
            where: { name },
        })
    }

    async findByDisplayId(displayId: number): Promise<Service | null> {
        return await prisma.service.findUnique({
            where: { display_id: displayId },
        })
    }

    async findMany(page: number, perPage: number, query?: string, active?: boolean): Promise<{ services: Service[], count: number }> {
        const where: Prisma.ServiceWhereInput = {
            name: { contains: query, mode: 'insensitive' }
        }

        if (active !== undefined) {
            where.active = active
        }

        const [services, count] = await Promise.all([
            prisma.service.findMany({
                where,
                take: perPage,
                skip: (page - 1) * perPage,
                orderBy: { display_id: 'desc' }
            }),
            prisma.service.count({
                where
            })
        ])
        return { services, count }
    }

    async save(service: Service): Promise<Service> {
        return await prisma.service.update({
            where: { id: service.id },
            data: service,
        })
    }

    async delete(id: string): Promise<void> {
        try {
            await prisma.service.delete({
                where: { id }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new ResourceDependencyError()
            }
            throw error
        }
    }

    async findNextAvailableDisplayId(): Promise<number> {
        const last = await prisma.service.findFirst({
            orderBy: {
                display_id: 'desc'
            }
        })
        return (last?.display_id ?? 0) + 1
    }
}
