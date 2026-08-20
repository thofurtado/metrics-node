import { PrismaClient } from '@prisma/client'
import { requestContext } from '@fastify/request-context'

let defaultPrisma: PrismaClient | null = null

export const prisma = new Proxy({} as unknown as PrismaClient, {
  get(target, prop) {
    let tenantPrisma: PrismaClient | undefined
    try {
      tenantPrisma = requestContext.get('prisma') as unknown as PrismaClient | undefined
    } catch {
      // Ignora erro se requestContext não estiver inicializado
    }

    if (!tenantPrisma) {
      // Em ambiente de teste ou CLI, usa instância direta do PrismaClient
      if (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.DATABASE_URL || !process.env.NODE_ENV) {
        if (!defaultPrisma) {
          defaultPrisma = new PrismaClient()
        }
        return (defaultPrisma as any)[prop]
      }
      // Falha de segurança se tentar acessar o banco fora de uma requisição web mapeada em produção
      throw new Error('Tentativa de acessar o banco de dados sem contexto de Tenant (Request).')
    }
    return (tenantPrisma as any)[prop]
  }
})
