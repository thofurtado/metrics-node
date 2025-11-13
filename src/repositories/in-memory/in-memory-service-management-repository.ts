import { ServiceManagementData, ServiceManagementRepository } from '../service-management-repository.ts'
import { Treatment } from '@prisma/client'


export class InMemoryServiceManagementRepository implements ServiceManagementRepository {
    public items: Treatment[] = []

    async getServiceManagementData(): Promise<ServiceManagementData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)
        const now = currentDate.getTime()

        // 1. Total de atendimentos do mês (apenas os INICIADOS este mês)
        const monthTreatments = this.items.filter(treatment => {
            const treatmentDate = new Date(treatment.opening_date)
            return treatmentDate >= startOfMonth && treatmentDate < startOfNextMonth
        })

        const totalTreatments = monthTreatments.length

        // 2. Atendimentos concluídos (CORREÇÃO: todos os resolvidos este mês, independente de quando começaram)
        const completedTreatments = this.items.filter(t => {
            if (t.status !== 'resolved' || !t.ending_date) return false
            
            const endingDate = new Date(t.ending_date)
            return endingDate >= startOfMonth && endingDate < startOfNextMonth
        }).length

        // 3. Atendimentos na bancada (TODOS os em aberto, independente do mês)
        const inWorkbench = this.items.filter(t => t.status === 'in_workbench').length

        // 4. Atendimentos externos em aberto (TODOS os em aberto, independente do mês)
        const externalOpen = this.items.filter(t => 
            ['pending', 'in_progress', 'follow_up'].includes(t.status)
        ).length

        // 5. Tempo médio de atendimento (apenas os INICIADOS este mês)
        const averageTreatmentTime = this.calculateAverageTime(monthTreatments, now)

        return {
            totalTreatments,
            completedTreatments,
            inWorkbench,
            externalOpen,
            averageTreatmentTime
        }
    }

    private calculateAverageTime(treatments: Treatment[], now: number): number {
        if (treatments.length === 0) return 0

        const totalTime = treatments.reduce((sum, treatment) => {
            const start = new Date(treatment.opening_date).getTime()
            const end = treatment.ending_date 
                ? new Date(treatment.ending_date).getTime() 
                : now
            
            const durationInMinutes = (end - start) / (1000 * 60)
            return sum + durationInMinutes
        }, 0)

        return Math.round(totalTime / treatments.length)
    }
}