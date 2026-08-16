import { FastifyInstance } from 'fastify'
import { updateTelemetry } from './update-telemetry'
import { provisionEquipment } from './provision-equipment'
import { linkEquipmentClient } from './link-equipment-client'
import { getOrphans } from './get-orphans'

export async function telemetryRoutes(app: FastifyInstance) {
  app.post('/equipments/provision', provisionEquipment)
  app.post('/equipments/:id/telemetry', updateTelemetry)
  
  // Essas deveriam estar em um arquivo separado autenticado, mas para facilitar colocaremos aqui por enquanto
  app.put('/equipments/:id/link-client', linkEquipmentClient)
  app.get('/equipments/orphans', getOrphans)
}
