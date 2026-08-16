import { FastifyInstance } from 'fastify'
import { updateTelemetry } from './update-telemetry'
import { provisionEquipment } from './provision-equipment'
import { linkEquipmentClient } from './link-equipment-client'
import { getOrphans } from './get-orphans'

export async function adminEquipmentsRoutes(app: FastifyInstance) {
  // Movido para adminEquipmentsRoutes
}

export async function telemetryRoutes(app: FastifyInstance) {
  app.post('/equipments/provision', provisionEquipment)
  app.post('/equipments/:id/telemetry', updateTelemetry)
  
  // Essas deveriam estar em um arquivo separado autenticado, mas para facilitar colocaremos aqui por enquanto
  // Movido para adminEquipmentsRoutes
}

