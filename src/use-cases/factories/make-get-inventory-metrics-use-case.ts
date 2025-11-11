import { PrismaInventoryMetricsRepository } from '@/repositories/prisma/prisma-inventory-metrics-repository'
import { GetInventoryMetricsUseCase } from '@/use-cases/get-inventory-metrics-use-case'

/**
 * Factory para criar o Use Case de obtenção de Métricas Operacionais/Inventário.
 */
export function MakeGetInventoryMetricsUseCase() {
    // Injete o repositório de Inventário/Operacional aqui
    const inventoryMetricsRepository = new PrismaInventoryMetricsRepository()
    
    const useCase = new GetInventoryMetricsUseCase(inventoryMetricsRepository)
    
    return useCase
}