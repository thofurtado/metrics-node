import { PrismaFinanceMetricsRepository } from '@/repositories/prisma/prisma-finance-metrics-repository'
import { GetFinanceMetricsUseCase } from '@/use-cases/get-finance-metrics-use-case'

/**
 * Factory para criar o Use Case de obtenção de Métricas Financeiras.
 * Isso garante que todas as dependências (como o repositório) sejam injetadas corretamente.
 */
export function MakeGetFinanceMetricsUseCase() {
    // Aqui você injetaria o repositório que acessa o banco de dados
    const financeMetricsRepository = new PrismaFinanceMetricsRepository()
    
    const useCase = new GetFinanceMetricsUseCase(financeMetricsRepository)
    
    return useCase
}