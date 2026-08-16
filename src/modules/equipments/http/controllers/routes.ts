import { sendCommand } from './send-command'
import { connectionManager } from '../../ws/connection-manager'
﻿import { FastifyInstance } from 'fastify'
import { updateTelemetry } from './update-telemetry'
import { provisionEquipment } from './provision-equipment'
import { linkEquipmentClient } from './link-equipment-client'
import { getOrphans } from './get-orphans'

export async function adminEquipmentsRoutes(app: FastifyInstance) {
  app.put('/equipments/:id/link-client', linkEquipmentClient)
  app.get('/equipments/orphans', getOrphans)
  app.post('/equipments/:id/command', sendCommand)
}

export async function telemetryRoutes(app: FastifyInstance) {
  app.post('/equipments/provision', provisionEquipment)
  app.post('/equipments/:id/telemetry', updateTelemetry)
  app.get('/equipments/:id/ws', { websocket: true }, (connection, req) => {
    // @ts-ignore
    const { id } = req.params;
    connectionManager.addConnection(id, connection);
    connection.socket.on('close', () => {
      connectionManager.removeConnection(id);
    });
  })
}
