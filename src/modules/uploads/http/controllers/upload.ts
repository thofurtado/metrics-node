import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

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
  
export async function deleteTransactionReceipt(request: FastifyRequest, reply: FastifyReply) {
  const uploadParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = uploadParamsSchema.parse(request.params);

  const transaction = await prisma.transaction.findUnique({
    where: { id }
  });

  if (!transaction) {
    return reply.status(404).send({ message: 'Transação não encontrada' });
  }

  if (transaction.attachment_url) {
    await storage.delete(transaction.attachment_url).catch(console.error);
    await prisma.transaction.update({
      where: { id },
      data: { attachment_url: null }
    });
  }

  return reply.status(200).send({ message: 'Comprovante removido com sucesso' });
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function uploadStandaloneReceipt(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ message: 'Nenhum arquivo enviado' });
  }

  // Obter descrição (da query ou do form multipart)
  const querySchema = z.object({
    description: z.string().optional(),
  });
  const { description: queryDesc } = querySchema.parse(request.query);
  const multipartDesc = data.fields?.description ? (data.fields.description as any).value : undefined;
  const multipartCaption = data.fields?.caption ? (data.fields.caption as any).value : undefined;
  const multipartText = data.fields?.text ? (data.fields.text as any).value : undefined;
  const description = multipartDesc || multipartCaption || multipartText || queryDesc || 'comprovante';

  const slug = slugify(String(description));
  const ext = data.filename.substring(data.filename.lastIndexOf('.'));
  const timestamp = Date.now();
  const filename = `${timestamp}_${slug}${ext}`;

  const fileBuffer = await data.toBuffer();
  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const receiptsDir = path.join(baseDir, 'receipts');

  await fs.mkdir(receiptsDir, { recursive: true });
  await fs.writeFile(path.join(receiptsDir, filename), fileBuffer);

  return reply.status(200).send({
    filename,
    description: String(description),
    date: new Date(timestamp).toISOString(),
    url: `/uploads/receipts/${filename}`
  });
}

export async function listStandaloneReceipts(request: FastifyRequest, reply: FastifyReply) {
  const listParamsSchema = z.object({
    page: z.coerce.number().default(1),
    per_page: z.coerce.number().default(10),
  });

  const { page, per_page } = listParamsSchema.parse(request.query);

  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const receiptsDir = path.join(baseDir, 'receipts');

  await fs.mkdir(receiptsDir, { recursive: true });
  const files = await fs.readdir(receiptsDir);

  const receipts = [];
  for (const filename of files) {
    const match = filename.match(/^(\d+)_(.+)(\.[^.]+)$/);
    if (match) {
      const timestamp = Number(match[1]);
      const slug = match[2];
      const displayDescription = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      receipts.push({
        filename,
        description: displayDescription,
        date: new Date(timestamp).toISOString(),
        url: `/uploads/receipts/${filename}`,
        timestamp
      });
    }
  }

  receipts.sort((a, b) => b.timestamp - a.timestamp);

  const totalCount = receipts.length;
  const startIndex = (page - 1) * per_page;
  const paginatedReceipts = receipts.slice(startIndex, startIndex + per_page).map(({ timestamp, ...rest }) => rest);

  return reply.status(200).send({
    receipts: paginatedReceipts,
    totalCount,
    page,
    perPage: per_page
  });
}

export async function deleteStandaloneReceipt(request: FastifyRequest, reply: FastifyReply) {
  const deleteParamsSchema = z.object({
    filename: z.string(),
  });

  const { filename } = deleteParamsSchema.parse(request.params);

  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const filePath = path.join(baseDir, 'receipts', filename);

  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error('Error deleting standalone file:', err);
      return reply.status(500).send({ message: 'Erro ao remover comprovante avulso' });
    }
    return reply.status(404).send({ message: 'Comprovante não encontrado' });
  }

  return reply.status(200).send({ message: 'Comprovante removido com sucesso' });
}

export async function linkReceiptToTransaction(request: FastifyRequest, reply: FastifyReply) {
  const linkParamsSchema = z.object({
    filename: z.string(),
    transactionId: z.string().uuid(),
  });

  const { filename, transactionId } = linkParamsSchema.parse(request.params);

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    return reply.status(404).send({ message: 'Transação não encontrada' });
  }

  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const sourcePath = path.join(baseDir, 'receipts', filename);

  try {
    await fs.access(sourcePath);
  } catch {
    return reply.status(404).send({ message: 'Comprovante avulso não encontrado' });
  }

  const fileBuffer = await fs.readFile(sourcePath);
  const ext = filename.substring(filename.lastIndexOf('.'));

  const relativeUrl = await storage.save(fileBuffer, 'transactions', ext);

  if (transaction.attachment_url) {
    await storage.delete(transaction.attachment_url).catch(console.error);
  }

  const updatedTransaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: { attachment_url: relativeUrl }
  });

  await fs.unlink(sourcePath).catch(console.error);

  return reply.status(200).send({
    transaction_id: updatedTransaction.id,
    attachment_url: updatedTransaction.attachment_url
  });
}

