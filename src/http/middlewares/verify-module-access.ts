import { FastifyReply, FastifyRequest } from 'fastify'

export function verifyModuleAccess(moduleRequired: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user || !request.user.modules) {
        return reply.status(403).send({ 
          message: 'Acesso negado. Token não possui definição de módulos.',
          code: 'NO_MODULES_DEFINED'
        })
      }

      const userModules = request.user.modules

      // Se super admin, bypass opcional
      if (request.user.role === 'ADMIN' && userModules.includes('SUPERADMIN_BYPASS')) {
          return // liberado
      }
      
      if (!userModules.includes(moduleRequired)) {
        return reply.status(403).send({ 
          message: `Acesso negado ao módulo necessário: ${moduleRequired}` 
        })
      }
    } catch (err) {
      return reply.status(401).send({ message: 'Falha na validação de permissões.' })
    }
  }
}
