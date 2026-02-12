// repositories/prisma/prisma-service-management-repository.ts
import { ServiceManagementData, ServiceManagementRepository } from '@/modules/services/repositories/service-management-repository.ts'
import { prisma } from '@/lib/prisma'

// repositories/prisma/prisma-service-management-repository.ts
export class PrismaServiceManagementRepository implements ServiceManagementRepository {
    async getServiceManagementData(): Promise<ServiceManagementData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)

        // 1. Total de atendimentos do mês (apenas os INICIADOS este mês)
        const totalTreatments = await prisma.treatment.count({
            where: {
                opening_date: {
                    gte: startOfMonth,
                    lt: startOfNextMonth
                }
            }
        })

        // 2. Atendimentos concluídos este mês (CORREÇÃO: todos os resolvidos este mês, independente de quando começaram)
        const completedTreatments = await prisma.treatment.count({
            where: {
                AND: [
                    {
                        ending_date: {
                            gte: startOfMonth,
                            lt: startOfNextMonth
                        }
                    },
                    {
                        status: 'resolved'
                    }
                ]
            }
        })

        // 3. Atendimentos na bancada (TODOS os em aberto, independente do mês)
        const inWorkbench = await prisma.treatment.count({
            where: {
                status: 'in_workbench'
            }
        })

        // 4. Atendimentos externos em aberto (TODOS os em aberto, independente do mês)
        const externalOpen = await prisma.treatment.count({
            where: {
                status: {
                    in: ['pending', 'in_progress', 'follow_up']
                }
            }
        })

        // 5. Tempo médio de atendimento (apenas os INICIADOS este mês)
        const averageTreatmentTime = await this.calculateAverageTreatmentTime(startOfMonth, startOfNextMonth)

        return {
            totalTreatments,
            completedTreatments,
            inWorkbench,
            externalOpen,
            averageTreatmentTime
        }
    }

    private async calculateAverageTreatmentTime(startOfMonth: Date, startOfNextMonth: Date): Promise<number> {
        // Buscar TODOS os atendimentos do mês (finalizados E em aberto)
        const allTreatments = await prisma.treatment.findMany({
            where: {
                opening_date: {
                    gte: startOfMonth,
                    lt: startOfNextMonth
                }
            },
            select: {
                opening_date: true,
                ending_date: true,
                status: true
            }
        })

        if (allTreatments.length === 0) {
            return 0
        }

        const now = new Date().getTime()

        const totalTime = allTreatments.reduce((sum, treatment) => {
            const start = treatment.opening_date.getTime()

            const end = treatment.ending_date
                ? treatment.ending_date.getTime()
                : now

            const durationInMinutes = (end - start) / (1000 * 60)
            return sum + durationInMinutes
        }, 0)

        return Math.round(totalTime / allTreatments.length)
    }
}