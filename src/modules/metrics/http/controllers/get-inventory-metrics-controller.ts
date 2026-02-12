// import { FastifyRequest, FastifyReply } from 'fastify'
// import { MakeGetInventoryMetricsUseCase } from '@/modules/stock/use-cases/factories/make-get-inventory-metrics-use-case'

// /**
//  * Lida com a requisição para buscar todas as métricas Operacionais/Inventário consolidadas.
//  */
// export async function getInventoryMetricsController(request: FastifyRequest, reply: FastifyReply) {
//     let inventoryMetrics

//     try {
//         const getInventoryMetricsUseCase = MakeGetInventoryMetricsUseCase()
        
//         // Busca o objeto consolidado com todas as métricas operacionais
//         inventoryMetrics = await getInventoryMetricsUseCase.execute()
        
//     } catch (err) {
//         if(err instanceof Error ){
//             return reply.status(409).send({ message: err.message })
//         }
//         throw err
//     }

//     return reply.status(200).send(inventoryMetrics)
// }