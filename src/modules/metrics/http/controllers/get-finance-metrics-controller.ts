// import { FastifyRequest, FastifyReply } from 'fastify'
// import { MakeGetFinanceMetricsUseCase } from '@/modules/financial/use-cases/factories/make-get-finance-metrics-use-case'

// /**
//  * Lida com a requisição para buscar todas as métricas financeiras consolidadas.
//  */
// export async function getFinanceMetricsController(request: FastifyRequest, reply: FastifyReply) {
//     let financeMetrics

//     try {
//         // Inicializa o Use Case através da Factory
//         const getFinanceMetricsUseCase = MakeGetFinanceMetricsUseCase()
        
//         // Executa a lógica de negócio (busca consolidada de todas as métricas financeiras)
//         financeMetrics = await getFinanceMetricsUseCase.execute()
        
//     } catch (err) {
//         // Tratamento de erros específicos ou genéricos
//         if(err instanceof Error ){
//             return reply.status(409).send({ message: err.message })
//         }

//         // Para erros não tratados, Fastify os lançará
//         throw err
//     }

//     // Retorna o objeto consolidado com todas as métricas financeiras
//     return reply.status(200).send(financeMetrics)
// }