import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetServiceMetricsUseCase } from '@/use-cases/factories/make-get-service-metrics-use-case'

/**
 * Lida com a requisição para buscar todas as métricas de Gestão de Serviços consolidadas.
 */
export async function getServiceMetricsController(request: FastifyRequest, reply: FastifyReply) {
    let serviceMetrics

    try {
        const getServiceMetricsUseCase = MakeGetServiceMetricsUseCase()
        
        // Busca o objeto consolidado com todas as métricas de atendimento
        serviceMetrics = await getServiceMetricsUseCase.execute()
        
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }

    return reply.status(200).send(serviceMetrics)
}