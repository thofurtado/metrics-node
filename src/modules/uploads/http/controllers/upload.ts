import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { requestContext } from '@fastify/request-context';

// const prisma = new PrismaClient();
const getPrisma = () => requestContext.get('prisma') as PrismaClient;
export async function uploadTransactionReceipt(request: FastifyRequest, reply: FastifyReply) {
  const uploadParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = uploadParamsSchema.parse(request.params);

  // Verifica se a transação existe
  const transaction = await getPrisma().transaction.findUnique({
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
  const updatedTransaction = await getPrisma().transaction.update({
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
  
    const product = await getPrisma().product.findUnique({
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
  
    const updatedProduct = await getPrisma().product.update({
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

    const employee = await getPrisma().employee.findUnique({
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

    const updatedEmployee = await getPrisma().employee.update({
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

  const transaction = await getPrisma().transaction.findUnique({
    where: { id }
  });

  if (!transaction) {
    return reply.status(404).send({ message: 'Transação não encontrada' });
  }

  if (transaction.attachment_url) {
    await storage.delete(transaction.attachment_url).catch(console.error);
    await getPrisma().transaction.update({
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
  let fileBuffer: Buffer | null = null;
  let originalFilename = '';
  let description = '';
  let value: number | null = null;

  const parts = request.parts();
  for await (const part of parts) {
    if (part.file) {
      fileBuffer = await part.toBuffer();
      originalFilename = part.filename;
    } else {
      if (['description', 'caption', 'text'].includes(part.fieldname)) {
        description = String(part.value);
      }
      if (['value', 'amount', 'valor'].includes(part.fieldname)) {
        value = Number(part.value) || null;
      }
    }
  }

  // Se não foi informada descrição nos campos multipart, tenta obter da query
  if (!description && !value) {
    const querySchema = z.object({
      description: z.string().optional(),
      value: z.coerce.number().optional()
    });
    const parsed = querySchema.parse(request.query);
    description = parsed.description || 'comprovante';
    value = parsed.value || null;
  }
  if (!description) description = 'comprovante';

  if (!fileBuffer) {
    return reply.status(400).send({ message: 'Nenhum arquivo enviado' });
  }

  // Usamos uma codificação segura base64url para armazenar os metadados no nome do arquivo
  const metadata = { d: description, v: value };
  const base64Meta = Buffer.from(JSON.stringify(metadata)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ext = originalFilename.substring(originalFilename.lastIndexOf('.'));
  const timestamp = Date.now();
  const filename = `${timestamp}_meta_${base64Meta}${ext}`;

  const tenant = requestContext.get('tenant') || 'default';
  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const receiptsDir = path.join(baseDir, tenant, 'receipts');

  await fs.mkdir(receiptsDir, { recursive: true });
  await fs.writeFile(path.join(receiptsDir, filename), fileBuffer);

  return reply.status(200).send({
    filename,
    description: String(description),
    value,
    date: new Date(timestamp).toISOString(),
    url: `/uploads/${tenant}/receipts/${filename}`
  });
}

export async function listStandaloneReceipts(request: FastifyRequest, reply: FastifyReply) {
  const listParamsSchema = z.object({
    page: z.coerce.number().default(1),
    per_page: z.coerce.number().default(10),
  });

  const { page, per_page } = listParamsSchema.parse(request.query);

  const tenant = requestContext.get('tenant') || 'default';
  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const receiptsDir = path.join(baseDir, tenant, 'receipts');

  await fs.mkdir(receiptsDir, { recursive: true });
  const files = await fs.readdir(receiptsDir);

  const receipts = [];
  for (const filename of files) {
    const b64Match = filename.match(/^(\d+)_b64_(.+)(\.[^.]+)$/);
    const metaMatch = filename.match(/^(\d+)_meta_(.+)(\.[^.]+)$/);
    
    let displayDescription = 'comprovante';
    let displayValue: number | null = null;
    let timestamp = 0;

    if (metaMatch) {
      timestamp = Number(metaMatch[1]);
      try {
        const base64 = metaMatch[2].replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        displayDescription = json.d || 'comprovante';
        displayValue = json.v || null;
      } catch (err) {
        displayDescription = 'comprovante';
      }
    } else if (b64Match) {
      timestamp = Number(b64Match[1]);
      try {
        const base64 = b64Match[2].replace(/-/g, '+').replace(/_/g, '/');
        displayDescription = Buffer.from(base64, 'base64').toString('utf-8');
      } catch (err) {
        displayDescription = 'comprovante';
      }
    } else {
      const match = filename.match(/^(\d+)_(.+)(\.[^.]+)$/);
      if (match) {
        timestamp = Number(match[1]);
        const slug = match[2];
        displayDescription = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      } else {
        continue;
      }
    }

    receipts.push({
      filename,
      description: displayDescription,
      value: displayValue,
      date: new Date(timestamp).toISOString(),
      url: `/uploads/${tenant}/receipts/${filename}`,
      timestamp
    });
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

  const tenant = requestContext.get('tenant') || 'default';
  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const filePath = path.join(baseDir, tenant, 'receipts', filename);

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
    transactionId: z.string(),
  });

  const { filename, transactionId } = linkParamsSchema.parse(request.params);

  const transaction = await getPrisma().transaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    return reply.status(404).send({ message: 'Transação não encontrada' });
  }

  const tenant = requestContext.get('tenant') || 'default';
  const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const sourcePath = path.join(baseDir, tenant, 'receipts', filename);

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

  const updatedTransaction = await getPrisma().transaction.update({
    where: { id: transactionId },
    data: { attachment_url: relativeUrl }
  });

  await fs.unlink(sourcePath).catch(console.error);

  return reply.status(200).send({
    transaction_id: updatedTransaction.id,
    attachment_url: updatedTransaction.attachment_url
  });
}

