// import { PrismaServiceMetricsRepository } from '@/repositories/prisma/prisma-service-metrics-repository'
// import { GetServiceMetricsUseCase } from '@/use-cases/get-service-metrics-use-case'

// /**
//  * Factory para criar o Use Case de obtenção de Métricas de Serviços.
//  */
// export function MakeGetServiceMetricsUseCase() {
//     // Injete o repositório de Serviços/Atendimento aqui
//     const serviceMetricsRepository = new PrismaServiceMetricsRepository()
    
//     const useCase = new GetServiceMetricsUseCase(serviceMetricsRepository)
    
//     return useCase
// }