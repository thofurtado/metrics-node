import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { holidayService } from '../../services/holiday-service';

export async function listHolidays(request: FastifyRequest, reply: FastifyReply) {
  const schema = z.object({
    year: z.coerce.number().default(new Date().getFullYear()),
  });

  const { year } = schema.parse(request.query);

  // Auto-sync na listagem para garantir que o ano atual tenha feriados nacionais
  await holidayService.syncHolidays(year);

  const holidays = await holidayService.getHolidaysForYear(year);
  return reply.status(200).send({ holidays });
}

export async function createCustomHoliday(request: FastifyRequest, reply: FastifyReply) {
  const schema = z.object({
    date: z.string(),
    name: z.string(),
    type: z.string().optional(),
  });

  const { date, name, type } = schema.parse(request.body);

  const holiday = await holidayService.addCustomHoliday({
    date: new Date(date.includes('T') ? date : `${date}T12:00:00Z`),
    name,
    type,
  });

  return reply.status(201).send({ holiday });
}

export async function removeHoliday(request: FastifyRequest, reply: FastifyReply) {
  const schema = z.object({
    id: z.string().uuid(),
  });

  const { id } = schema.parse(request.params);

  await holidayService.deleteHoliday(id);
  return reply.status(204).send();
}
