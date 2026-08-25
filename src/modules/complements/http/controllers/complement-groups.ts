import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function createComplementGroup(request: FastifyRequest, reply: FastifyReply) {
  const createBodySchema = z.object({
    name: z.string().min(1, 'Nome do grupo é obrigatório'),
    min_quantity: z.number().int().min(0).default(0),
    max_quantity: z.number().int().min(1).default(1),
    free_quantity: z.number().int().min(0).default(0),
    options: z.array(
      z.object({
        name: z.string().min(1, 'Nome da opção é obrigatório'),
        price: z.number().min(0).default(0),
        linked_product_id: z.string().nullable().optional(),
        linked_supply_id: z.string().nullable().optional(),
      })
    ).optional(),
  })

  const data = createBodySchema.parse(request.body)

  const group = await prisma.complementGroup.create({
    data: {
      name: data.name,
      min_quantity: data.min_quantity,
      max_quantity: data.max_quantity,
      free_quantity: data.free_quantity,
      options: data.options?.length
        ? {
            create: data.options.map((opt) => ({
              name: opt.name,
              price: opt.price,
              linked_product_id: opt.linked_product_id || null,
              linked_supply_id: opt.linked_supply_id || null,
            })),
          }
        : undefined,
    },
    include: {
      options: true,
    },
  })

  return reply.status(201).send({ group })
}

export async function fetchComplementGroups(request: FastifyRequest, reply: FastifyReply) {
  const groups = await prisma.complementGroup.findMany({
    where: { active: true },
    include: {
      options: {
        where: { active: true },
        orderBy: { name: 'asc' },
      },
      products: {
        select: {
          product_id: true,
        },
      },
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return reply.status(200).send({ groups })
}

export async function updateComplementGroup(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  })

  const updateBodySchema = z.object({
    name: z.string().min(1).optional(),
    min_quantity: z.number().int().min(0).optional(),
    max_quantity: z.number().int().min(1).optional(),
    free_quantity: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    options: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        price: z.number().min(0).default(0),
        linked_product_id: z.string().nullable().optional(),
        linked_supply_id: z.string().nullable().optional(),
      })
    ).optional(),
    product_ids: z.array(z.string().uuid()).optional(),
  })

  const { id } = paramsSchema.parse(request.params)
  const data = updateBodySchema.parse(request.body)

  const group = await prisma.$transaction(async (tx) => {
    // Se enviou lista de opções, sincronizamos
    if (data.options) {
      const existingOptions = await tx.complementOption.findMany({
        where: { group_id: id },
      })
      const incomingIds = data.options.filter((o) => o.id).map((o) => o.id!)

      // Desativar ou deletar opções removidas
      const toDelete = existingOptions.filter((e) => !incomingIds.includes(e.id))
      if (toDelete.length) {
        await tx.complementOption.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        })
      }

      // Upsert das opções
      for (const opt of data.options) {
        if (opt.id) {
          await tx.complementOption.update({
            where: { id: opt.id },
            data: {
              name: opt.name,
              price: opt.price,
              linked_product_id: opt.linked_product_id || null,
              linked_supply_id: opt.linked_supply_id || null,
            },
          })
        } else {
          await tx.complementOption.create({
            data: {
              group_id: id,
              name: opt.name,
              price: opt.price,
              linked_product_id: opt.linked_product_id || null,
              linked_supply_id: opt.linked_supply_id || null,
            },
          })
        }
      }
    }

    if (data.product_ids !== undefined) {
      await tx.productComplementGroup.deleteMany({
        where: { group_id: id },
      })
      if (data.product_ids.length > 0) {
        await tx.productComplementGroup.createMany({
          data: data.product_ids.map((pId, idx) => ({
            group_id: id,
            product_id: pId,
            order: idx,
          })),
        })
      }
    }

    return tx.complementGroup.update({
      where: { id },
      data: {
        name: data.name,
        min_quantity: data.min_quantity,
        max_quantity: data.max_quantity,
        free_quantity: data.free_quantity,
        active: data.active,
      },
      include: {
        options: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
        products: {
          select: { product_id: true },
        },
      },
    })
  })

  return reply.status(200).send({ group })
}

export async function deleteComplementGroup(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  })

  const { id } = paramsSchema.parse(request.params)

  await prisma.complementGroup.delete({
    where: { id },
  })

  return reply.status(204).send()
}

export async function syncProductComplementGroups(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  })

  const bodySchema = z.object({
    groupIds: z.array(z.string().uuid()),
  })

  const { id: product_id } = paramsSchema.parse(request.params)
  const { groupIds } = bodySchema.parse(request.body)

  await prisma.$transaction(async (tx) => {
    await tx.productComplementGroup.deleteMany({
      where: { product_id },
    })

    if (groupIds.length) {
      await tx.productComplementGroup.createMany({
        data: groupIds.map((group_id, index) => ({
          product_id,
          group_id,
          order: index,
        })),
      })
    }
  })

  const product = await prisma.product.findUnique({
    where: { id: product_id },
    include: {
      category: true,
      subcategory: true,
      complementGroups: {
        include: {
          group: {
            include: {
              options: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  return reply.status(200).send({ product })
}
