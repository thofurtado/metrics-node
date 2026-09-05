import { updateEquipment } from './update-equipment'
import { deleteEquipment } from './delete-equipment'
import { createEquipment } from './create-equipment'
﻿import { sendCommand } from './send-command'
import { connectionManager } from '../../ws/connection-manager'
import { FastifyInstance } from 'fastify'
import { updateTelemetry } from './update-telemetry'
import { provisionEquipment } from './provision-equipment'
import { linkEquipmentClient } from './link-equipment-client'
import { getOrphans } from './get-orphans'
import { getPrismaForDomain } from '@/lib/tenant-manager'

export async function adminEquipmentsRoutes(app: FastifyInstance) {
  app.post('/equipments', createEquipment)
  app.put('/equipments/:id', updateEquipment)
  app.delete('/equipments/:id', deleteEquipment)
  app.put('/equipments/:id/link-client', linkEquipmentClient)
  app.get('/equipments/orphans', getOrphans)
  app.post('/equipments/:id/command', sendCommand)
}

export async function telemetryRoutes(app: FastifyInstance) {
  app.post('/equipments/provision', provisionEquipment)
  app.post('/equipments/:id/telemetry', updateTelemetry)
  
  app.get('/equipments/:id/ws', { websocket: true }, async (connection, req) => {
    // @ts-ignore
    const { id } = req.params;
    const domain = req.headers['x-tenant-domain'] as string;
    
    connectionManager.addConnection(id, connection);
    
    if (domain) {
      try {
        const prisma = await getPrismaForDomain(domain);
        if (prisma) {
          await prisma.equipment.update({
            where: { id },
            data: { is_online: true, last_seen_at: new Date() }
          });
        }
      } catch (err) { }
    }

    let isAlive = true;
    connection.on('pong', () => { isAlive = true; });
    
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(pingInterval);
        return connection.terminate();
      }
      isAlive = false;
      connection.ping();
    }, 120000);

    connection.on('close', async () => {
      clearInterval(pingInterval);
      connectionManager.removeConnection(id);
      
      if (domain) {
        try {
          const prisma = await getPrismaForDomain(domain);
          if (prisma) {
            await prisma.equipment.update({
              where: { id },
              data: { is_online: false, last_seen_at: new Date() }
            });
          }
        } catch (err) { }
      }
    });
  })
}
