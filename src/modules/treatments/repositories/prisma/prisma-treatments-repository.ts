import { prisma } from '@/lib/prisma'
import { Treatment, Prisma } from '@prisma/client'
import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'
import { GetTreatmentDTO } from '@/modules/treatments/repositories/DTO/get-treatments-dto'

export class PrismaTreatmentsRepository implements TreatmentsRepository {
    async getMonthTreatmentsAmount(date?: Date): Promise<{ amount: number; diffFromLastMonth: number }> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1
        const thisMonthTreatmentsAmount = await prisma.treatment.count({
            where: {
                AND: [
                    {
                        opening_date: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1), // End of month (excluding the last day)
                        },
                    },
                ]
            }
        })

        const lastMonthTreatmentsAmount = await prisma.treatment.count({
            where: {
                AND: [
                    {
                        opening_date: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1), // End of month (excluding the last day)
                        },
                    },
                ]
            }
        })

        const diffFromMonths = lastMonthTreatmentsAmount && thisMonthTreatmentsAmount ?
            (thisMonthTreatmentsAmount * 100) / lastMonthTreatmentsAmount : null

        return {
            amount: thisMonthTreatmentsAmount,
            diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
        }
    }
    async findByActive(pageIndex?: number, perPage?: number, treatmentId?: string, clientName?: string, status?: string): Promise<GetTreatmentDTO | null> {
        if (!pageIndex) pageIndex = 1
        let take = 6
        if (perPage) take = perPage
        let skip: number = 0
        if (pageIndex >= 1) {
            skip = (pageIndex * take) - take
        }

        // Construir condições WHERE dinamicamente
        const whereConditions: any = {}

        // Condição para treatmentId
        if (treatmentId) {
            whereConditions.id = { contains: treatmentId }
        }

        // Condição para clientName
        if (clientName) {
            whereConditions.clients = {
                name: {
                    contains: clientName,
                    mode: 'insensitive'
                }
            }
        }

        // Condição para status
        if (status === 'open') {
            whereConditions.status = { in: ['pending', 'in_progress', 'on_hold', 'follow_up', 'in_workbench'] }
        } else if (status === 'history') {
            whereConditions.status = { in: ['resolved', 'canceled'] }
        } else if (status && status !== 'all') {
            whereConditions.status = { equals: status }
        } else if (!status || status === 'all') {
            whereConditions.OR = [
                { status: { equals: 'pending' } },
                { status: { equals: 'in_progress' } },
                { status: { equals: 'on_hold' } },
                { status: { equals: 'follow_up' } },
                { status: { equals: 'in_workbench' } },
                { status: { equals: 'resolved' } },
                { status: { equals: 'canceled' } },
            ]
        }

        // Count total
        const totalCount = await prisma.treatment.count({
            where: whereConditions
        })

        // Buscar tratamentos - Incluindo Items para cálculo
        const treatmentsRaw = await prisma.treatment.findMany({
            skip,
            take,
            where: whereConditions,
            orderBy: [
                {
                    opening_date: 'asc'
                }
            ],
            include: {
                clients: true,
                items: {
                    select: {
                        quantity: true,
                        salesValue: true,
                        discount: true
                    }
                }
            }
        })

        // Calcular amount dinamicamente para cada tratamento
        const treatments = treatmentsRaw.map(t => {
            const amount = t.items.reduce((acc, item) => {
                const qty = item.quantity || 0
                const val = item.salesValue || 0
                const disc = item.discount || 0
                return acc + (qty * val - disc)
            }, 0)

            // Remove items from result if not part of DTO, or keep if needed (DTO usually expects what is returned)
            // But we need to inject 'amount' into the object to match the DTO expectation which probably still has 'amount'
            return {
                ...t,
                amount: Number(amount.toFixed(2))
            }
        })

        return {
            treatments: treatments as any, // Cast to match DTO if necessary
            totalCount,
            perPage: take,
            pageIndex
        }
    }


    async create(data: Prisma.TreatmentUncheckedCreateInput): Promise<Treatment> {
        const treatment = await prisma.treatment.create({
            data
        })
        return treatment
    }

    async findById(id: string): Promise<(Treatment & { amount: number }) | null> {
        const treatment = await prisma.treatment.findFirst({
            where: {
                id
            },
            include: {
                clients: true,
                equipments: true,
                items: {
                    include: {
                        product: {
                            include: {
                                compositions: {
                                    include: {
                                        supply: true
                                    }
                                }
                            }
                        },
                        service: true,
                        supply: true
                    }
                },
                interactions: true
            }
        })

        if (!treatment) return null

        // Calculate total amount
        const amount = treatment.items.reduce((acc, item) => {
            const qty = item.quantity || 0
            const val = item.salesValue || 0
            const disc = item.discount || 0
            return acc + (qty * val - disc)
        }, 0)

        return {
            ...treatment,
            items: treatment.items.map(item => {
                const isItem = !!(item.product || item.supply)
                const name = item.product?.name || item.service?.name || item.supply?.name || 'Item desconhecido'

                return {
                    ...item,
                    items: {
                        name,
                        isItem
                    }
                }
            }) as any,
            amount: Number(amount.toFixed(2))
        } as any
    }

    async update(id: string, data: Prisma.TreatmentUncheckedUpdateInput) {
        const updatedTreatment = await prisma.treatment.update({
            where: { id },
            data,
        })

        return updatedTreatment
    }
    async findByClient(client_id: string) {
        const treatments = await prisma.treatment.findMany({
            where: {
                client_id
            }
        })
        return treatments
    }
    async findByStatus(status: string) {
        const treatments = prisma.treatment.findMany({
            where: {
                status: status
            },
            include: {
                users: true,
                equipments: true,
                items: true
            }
        })

        return treatments
    }
    async close(id: string, tx?: Prisma.TransactionClient): Promise<Treatment | null> {
        const client = tx ?? prisma
        const treatment = await client.treatment.update({
            where: { id },
            data: {
                ending_date: new Date(),
                status: 'resolved'
            }
        })
        return treatment
    }

}
