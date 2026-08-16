import { PrismaClient } from '@prisma/client'
import { requestContext } from '@fastify/request-context'

export const prisma = new Proxy({} as unknown as PrismaClient, {
  get(target, prop) {
    const tenantPrisma = requestContext.get('prisma') as unknown as PrismaClient | undefined;
    if (!tenantPrisma) {
      // Falha de segurança se tentar acessar o banco fora de uma requisição web mapeada
      throw new Error('Tentativa de acessar o banco de dados sem contexto de Tenant (Request).');
    }
    return (tenantPrisma as any)[prop];
  }
});
