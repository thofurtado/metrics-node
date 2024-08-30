import { prisma } from '@/lib/prisma'
import { Treatment, Prisma } from '@prisma/client'
import { TreatmentsRepository } from '../treatments-repository'
import { GetTreatmentDTO } from '../DTO/get-treatments-dto'

export class PrismaTreatmentsRepository implements TreatmentsRepository {
    async getMonthTreatmentsAmount(): Promise<{ amount: number; diffFromLastMonth: number }> {
        const month = new Date()
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
                            gte: new Date(thisMonthYear, (thisMonthNumber-1) - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, (thisMonthNumber-1), 1), // End of month (excluding the last day)
                        },
                    },
                ]
            }
        })

        const diffFromMonths = lastMonthTreatmentsAmount && thisMonthTreatmentsAmount ?
            (thisMonthTreatmentsAmount * 100) / lastMonthTreatmentsAmount :null

        return {
            amount: thisMonthTreatmentsAmount,
            diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
        }
    }
    async findByActive(pageIndex?: number, perPage?: number, treatmentId?: string, clientName?: string, status?: string): Promise<GetTreatmentDTO | null> {
        if (!pageIndex)
            pageIndex = 1
        let take = 6
        if (perPage)
            take = perPage
        let skip: number = 0
        if (pageIndex >= 1) {
            skip = (pageIndex * take) - take
        }

        let totalCount
        if (!status) {
            totalCount = await prisma.treatment.count({
                where: {
                    OR: [
                        { status: { equals: 'pending' } },
                        { status: { equals: 'in_progress' } },
                        { status: { equals: 'on_hold' } },
                        { status: { equals: 'follow_up' } },
                        { status: { equals: 'in_workbench' } },
                    ],
                    AND: [
                        {
                            id: { contains: treatmentId }
                        },
                        {
                            clients: {
                                name: {
                                    contains: clientName,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        {
                            status: { equals: status }
                        }
                    ]

                }
            })
        } else {
            totalCount = await prisma.treatment.count({
                where: {
                    AND: [
                        {
                            id: { contains: treatmentId }
                        },
                        {
                            clients: {
                                name: {
                                    contains: clientName,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        {
                            status: { equals: status }
                        }
                    ]
                },
            })
        }
        let treatments
        if (status) {
            treatments = await prisma.treatment.findMany({
                skip, take,
                where: {
                    AND: [
                        {
                            id: { contains: treatmentId }
                        },
                        {
                            clients: {
                                name: {
                                    contains: clientName,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        {
                            status: { equals: status }
                        }
                    ]
                },
                orderBy: [
                    {
                        opening_date: 'asc'
                    }
                ],
                include: {
                    clients: true
                }
            })
        } else {
            treatments = await prisma.treatment.findMany({
                skip, take,
                where: {
                    OR: [
                        { status: { equals: 'pending' } },
                        { status: { equals: 'in_progress' } },
                        { status: { equals: 'on_hold' } },
                        { status: { equals: 'follow_up' } },
                        { status: { equals: 'in_workbench' } },
                    ],
                    AND: [
                        {
                            id: { contains: treatmentId }
                        },
                        {
                            clients: {
                                name: {
                                    contains: clientName,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        {
                            status: { equals: status }
                        }
                    ]
                },
                orderBy: [
                    {
                        opening_date: 'asc'
                    }
                ],
                include: {
                    clients: true
                }
            })
        }
        return {
            treatments,
            totalCount,
            perPage: take,
            pageIndex
        }
    }

    async changeValue(id: string, value: number, entry: boolean): Promise<void> {
        if (entry) {
            await prisma.treatment.update({
                where: { id },
                data: {
                    amount: { increment: value }
                }
            })
        } else {
            await prisma.treatment.update({
                where: { id },
                data: {
                    amount: { decrement: value }
                }
            })
        }

    }
    async create(data: Prisma.TreatmentUncheckedCreateInput): Promise<Treatment> {
        const treatment = await prisma.treatment.create({
            data
        })
        return treatment
    }
    async findById(id: string): Promise<Treatment | null> {
        const treatment = await prisma.treatment.findFirst({
            where: {
                id
            },
            include: {
                clients: true,
                equipments: true,
                items: {
                    include: {
                        items: true
                    }
                },
                interactions: true
            }
        })
        return treatment
    }
    async update(id: string, data: Prisma.TreatmentUncheckedUpdateInput): Promise<{
        id: string;
        opening_date: Date;
        ending_date: Date | null;
        contact: string | null;
        user_id: string | null;
        client_id: string | null;
        equipment_id: string | null;
        request: string;
        status: string;
        amount: number;
        observations: string | null;
    }> {
        // Validate input data (optional but recommended)
        // You can add checks for required properties or specific data types

        const updatedTreatment = await prisma.treatment.update({
            where: { id }, // Ensure update targets the correct treatment
            data, // Update data based on the provided input
        })

        return updatedTreatment
    }
    async findByClient(client_id: string): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; status: string; amount: number; observations: string | null }[] | null> {
        const treatments = await prisma.treatment.findMany({
            where: {
                client_id
            }
        })
        return treatments
    }
    async findByStatus(status: string): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; status: string; amount: number; observations: string | null }[] | null> {
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
    async close(id: string): Promise<Treatment | null> {
        const treatment = await prisma.treatment.update({
            where: { id },
            data: {
                ending_date: new Date(),
                status: 'resolved'
            }
        })
        return treatment
    }

}
