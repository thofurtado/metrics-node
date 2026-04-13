import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function uploadTransactionReceipt(request: FastifyRequest, reply: FastifyReply) {
  const uploadParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = uploadParamsSchema.parse(request.params);

  // Verifica se a transação existe
  const transaction = await prisma.transaction.findUnique({
    where: { id }
  });

  if (!transaction) {
    return reply.status(404).send({ message: 'Transação não encontrada' });
  }

  const data = await request.file();

  if (!data) {
    return reply.status(400).send({ message: 'Nenhum arquivo enviado' });
  }

  const fileBuffer = await data.toBuffer();
  
  // Extrai a extensão original
  const ext = data.filename.substring(data.filename.lastIndexOf('.'));
  
  // Salva usando a abstração de storage
  const relativeUrl = await storage.save(fileBuffer, 'transactions', ext);

  // Se já havia um anexo anterior, podemos deletar (opcional, para economizar espaço)
  if (transaction.attachment_url) {
    await storage.delete(transaction.attachment_url).catch(console.error);
  }

  // Atualiza no banco
  const updatedTransaction = await prisma.transaction.update({
    where: { id },
    data: { attachment_url: relativeUrl }
  });

  return reply.status(200).send({ 
    attachment_url: updatedTransaction.attachment_url 
  });
}

export async function uploadProductImage(request: FastifyRequest, reply: FastifyReply) {
    const uploadParamsSchema = z.object({
      id: z.string().uuid(),
    });
  
    const { id } = uploadParamsSchema.parse(request.params);
  
    const product = await prisma.product.findUnique({
      where: { id }
    });
  
    if (!product) {
      return reply.status(404).send({ message: 'Produto não encontrado' });
    }
  
    const data = await request.file();
  
    if (!data) {
      return reply.status(400).send({ message: 'Nenhum arquivo enviado' });
    }
  
    const fileBuffer = await data.toBuffer();
    const ext = data.filename.substring(data.filename.lastIndexOf('.'));
    const relativeUrl = await storage.save(fileBuffer, 'products', ext);
  
    if (product.image_url) {
      await storage.delete(product.image_url).catch(console.error);
    }
  
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { image_url: relativeUrl }
    });
  
    return reply.status(200).send({ 
      image_url: updatedProduct.image_url 
    });
}
  
export async function uploadEmployeePhoto(request: FastifyRequest, reply: FastifyReply) {
    const uploadParamsSchema = z.object({
        id: z.string().uuid(),
    });

    const { id } = uploadParamsSchema.parse(request.params);

    const employee = await prisma.employee.findUnique({
        where: { id }
    });

    if (!employee) {
        return reply.status(404).send({ message: 'Funcionário não encontrado' });
    }

    const data = await request.file();

    if (!data) {
        return reply.status(400).send({ message: 'Nenhum arquivo enviado' });
    }

    const fileBuffer = await data.toBuffer();
    const ext = data.filename.substring(data.filename.lastIndexOf('.'));
    const relativeUrl = await storage.save(fileBuffer, 'employees', ext);

    if (employee.photo_url) {
        await storage.delete(employee.photo_url).catch(console.error);
    }

    const updatedEmployee = await prisma.employee.update({
        where: { id },
        data: { photo_url: relativeUrl }
    });

    return reply.status(200).send({ 
        photo_url: updatedEmployee.photo_url 
    });
}
  
