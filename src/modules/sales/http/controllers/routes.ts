import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyModuleAccess } from '@/http/middlewares/verify-module-access'
import { FastifyInstance } from 'fastify'
import { create } from './create'
import {
    getCancelamentosDasVendas,
    getContaDasVendas,
    getDetalheDaVenda,
    getFiltrosDasVendas,
    getListaDeVendas,
    getProdutosVendidos,
    getVendedoresDoPeriodo,
} from './vendas-controller'

export async function salesRoutes(app: FastifyInstance) {
    app.post('/sales', { onRequest: [verifyJwt] }, create)

    // Módulo Vendas (etapas 2 e 3, 16/10/2026): só leitura, com a mesma trava da Conferência de caixa (o módulo que virou
    // "Vendas" na web): login e o módulo Caixa ou o Financeiro.
    app.register(async (vendas) => {
        vendas.addHook('onRequest', verifyJwt)
        vendas.addHook('onRequest', verifyModuleAccess('cashier', 'finance'))

        vendas.get('/api/vendas/conta', getContaDasVendas)
        vendas.get('/api/vendas/filtros', getFiltrosDasVendas)
        vendas.get('/api/vendas/produtos', getProdutosVendidos)
        vendas.get('/api/vendas/vendedores', getVendedoresDoPeriodo)
        vendas.get('/api/vendas/cancelamentos', getCancelamentosDasVendas)
        vendas.get('/api/vendas', getListaDeVendas)
        vendas.get('/api/vendas/:id', getDetalheDaVenda)
    })
}
