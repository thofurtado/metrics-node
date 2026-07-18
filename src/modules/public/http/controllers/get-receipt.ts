import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

import { requestContext } from '@fastify/request-context';

// const prisma = new PrismaClient();
const getPrisma = () => requestContext.get('prisma') as PrismaClient;
export async function getReceipt(request: FastifyRequest, reply: FastifyReply) {
    const getParamsSchema = z.object({
        id: z.string().uuid(),
    });

    try {
        const { id } = getParamsSchema.parse(request.params);

        const transaction = await getPrisma().transaction.findUnique({
            where: { id },
            select: {
                id: true,
                operation: true,
                description: true,
                amount: true,
                totalValue: true,
                data_vencimento: true,
                data_emissao: true,
                confirmed: true,
                payment_method: true,
                attachment_url: true,
                supplier: {
                    select: {
                        name: true
                    }
                },
                sectors: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!transaction) {
            return reply.status(404).send({ message: 'Transação não encontrada.' });
        }

        // Se quiser ocultar recibos vazios:
        // Se a transação existe mas não tem anexo, decidimos se retornamos algo pra renderizar mensagem no front.
        // O front cuidará disso lendo attachment_url = null
        
        return reply.status(200).send(transaction);

    } catch (err) {
        if (err instanceof z.ZodError) {
            return reply.status(400).send({ message: 'ID Inválido' });
        }
        console.error(err);
        return reply.status(500).send({ message: 'Erro interno do servidor' });
    }
}
