import { FastifyReply, FastifyRequest } from 'fastify'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public",
})

export async function getTenantInfo(request: FastifyRequest, reply: FastifyReply) {
  let origin = request.headers.origin || request.headers.referer || request.headers.host || ''
  
  let domain = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
  domain = domain.replace(/^api\./, '')
  
  if (request.headers['x-tenant-domain']) {
    domain = request.headers['x-tenant-domain'] as string
  }

  if (process.env.NODE_ENV === 'development' && (domain.includes('localhost') || domain.includes('127.0.0.1'))) {
    return reply.status(200).send({
      name: 'Local Dev Tenant',
      landingPageType: 'NONE',
      landingPageSlug: null
    })
  }

  try {
    const result = await pool.query('SELECT * FROM "Tenant" WHERE $1 = ANY(string_to_array(replace(domain, \' \', \'\'), \',\'))', [domain])

    if (result.rows.length === 0) {
      return reply.status(404).send({ message: 'Tenant not found.' })
    }

    const tenant = result.rows[0]

    if (tenant.status !== 'active') {
      return reply.status(403).send({ message: 'Tenant is suspended.' })
    }

    return reply.status(200).send({
      name: tenant.name,
      landingPageType: tenant.landingPageType || 'NONE',
      landingPageSlug: tenant.landingPageSlug || null
    })
  } catch (error) {
    console.error('Error fetching tenant info:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
