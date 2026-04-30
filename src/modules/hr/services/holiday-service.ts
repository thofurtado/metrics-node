import { prisma } from '@/lib/prisma';
import axios from 'axios';
import { format } from 'date-fns';

export class HolidayService {
  /**
   * Sincroniza os feriados nacionais da BrasilAPI para o ano especificado.
   * Só faz a busca e inserção se o ano ainda não possuir feriados nacionais cadastrados.
   */
  async syncHolidays(year: number) {
    try {
      // Verifica se já existem feriados nacionais para o ano
      const existingHolidays = await prisma.holiday.findFirst({
        where: {
          type: 'NATIONAL',
          date: {
            gte: new Date(`${year}-01-01T00:00:00Z`),
            lte: new Date(`${year}-12-31T23:59:59Z`),
          },
        },
      });

      if (existingHolidays) {
        return { message: 'Feriados já sincronizados para este ano.' };
      }

      // Busca na BrasilAPI
      const response = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      const holidaysData = response.data;

      // Prepara os dados para o Prisma
      const holidaysToInsert = holidaysData.map((h: any) => ({
        date: new Date(`${h.date}T12:00:00Z`),
        name: h.name,
        type: 'NATIONAL',
      }));

      // Insere em lote, ignorando conflitos (se a data já existir como municipal, etc., ou simplesmente usa createMany)
      await prisma.holiday.createMany({
        data: holidaysToInsert,
        skipDuplicates: true,
      });

      return { message: 'Feriados sincronizados com sucesso.', count: holidaysToInsert.length };
    } catch (error) {
      console.error('Erro ao sincronizar feriados da BrasilAPI:', error);
      throw new Error('Falha ao sincronizar feriados.');
    }
  }

  /**
   * Retorna os feriados cadastrados no banco para o ano especificado.
   */
  async getHolidaysForYear(year: number) {
    return await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lte: new Date(`${year}-12-31T23:59:59Z`),
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  /**
   * Adiciona um feriado local (municipal, estadual, customizado) manualmente.
   */
  async addCustomHoliday(data: { date: Date; name: string; type?: string }) {
    return await prisma.holiday.create({
      data: {
        date: data.date,
        name: data.name,
        type: data.type || 'MUNICIPAL',
      },
    });
  }

  /**
   * Remove um feriado customizado.
   */
  async deleteHoliday(id: string) {
    return await prisma.holiday.delete({
      where: { id },
    });
  }
}

export const holidayService = new HolidayService();
