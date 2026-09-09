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
          let url = process.env.DATABASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_eureca";
          if (url.endsWith(':5432') || url.endsWith(':5432/') || url.includes('/postgres')) {
            url = url.replace(/\/postgres(\?.*)?$/, '/db_eureca$1').replace(/:5432\/?(\?.*)?$/, ':5432/db_eureca$1');
          }
          defaultPrisma = new PrismaClient({
            datasources: {
              db: {
                url,
              },
            },
          })
        }
        return (defaultPrisma as any)[prop]
      }
      // Falha de segurança se tentar acessar o banco fora de uma requisição web mapeada em produção
      throw new Error('Tentativa de acessar o banco de dados sem contexto de Tenant (Request).')
    }
    return (tenantPrisma as any)[prop]
  }
})
