import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function createSubcategory(request: FastifyRequest, reply: FastifyReply) {
  const createBodySchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    category_id: z.string().uuid('ID de categoria inválido'),
    accepts_fractions: z.boolean().optional().default(false),
    max_fractions: z.number().int().min(1).max(4).optional().default(1),
  })

  const data = createBodySchema.parse(request.body)

  const subcategory = await prisma.subcategory.create({
    data: {
      name: data.name,
      category_id: data.category_id,
      accepts_fractions: data.accepts_fractions,
      max_fractions: data.max_fractions,
    },
    include: {
      category: true,
    },
  })

  return reply.status(201).send({ subcategory })
}

export async function fetchSubcategories(request: FastifyRequest, reply: FastifyReply) {
  const querySchema = z.object({
    category_id: z.string().optional(),
  })

  const { category_id } = querySchema.parse(request.query)

  const subcategories = await prisma.subcategory.findMany({
    where: {
      category_id: category_id || undefined,
      active: true,
    },
    include: {
      category: true,
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  return reply.status(200).send({ subcategories })
}

export async function updateSubcategory(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  })

  const updateBodySchema = z.object({
    name: z.string().min(1).optional(),
    category_id: z.string().uuid().optional(),
    accepts_fractions: z.boolean().optional(),
    max_fractions: z.number().int().min(1).max(4).optional(),
    active: z.boolean().optional(),
  })

  const { id } = paramsSchema.parse(request.params)
  const data = updateBodySchema.parse(request.body)

  const subcategory = await prisma.subcategory.update({
    where: { id },
    data,
    include: {
      category: true,
    },
  })

  return reply.status(200).send({ subcategory })
}

export async function deleteSubcategory(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  })

  const { id } = paramsSchema.parse(request.params)

  await prisma.subcategory.delete({
    where: { id },
  })

  return reply.status(204).send()
}
