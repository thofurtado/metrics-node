import crypto from 'crypto'
import fs from 'fs'

/**
 * Autenticação da PUBLICAÇÃO de releases (instaladores e APKs).
 *
 * Chave nova e dedicada: variável de ambiente RELEASE_UPLOAD_KEY (só serve para publicar).
 * Ela é independente da chave de sincronização do PDV (PDV_API_KEY) e da chave do Ponto (API_KEY_PONTO),
 * que continuam valendo para os seus próprios usos e NÃO são tocadas aqui.
 *
 * Transição sem quebrar nada: enquanto RELEASE_ALLOW_LEGACY_KEYS não for "false", as chaves antigas
 * continuam sendo aceitas para publicar (e cada uso gera um aviso no log). Depois de configurar
 * RELEASE_UPLOAD_KEY e testar uma publicação, definir RELEASE_ALLOW_LEGACY_KEYS=false desliga as antigas
 * sem precisar de novo deploy de código.
 */

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

export function checkReleaseKey(header: unknown): { ok: boolean; legacy: boolean } {
  const provided = typeof header === 'string' ? header : ''
  if (!provided) return { ok: false, legacy: false }

  const fresh = process.env.RELEASE_UPLOAD_KEY
  if (fresh && safeEqual(provided, fresh)) return { ok: true, legacy: false }

  if (process.env.RELEASE_ALLOW_LEGACY_KEYS !== 'false') {
    const legacyKeys = [
      process.env.PDV_API_KEY || 'chave-secreta-pdv-123',
      process.env.API_KEY_PONTO || 'metrics_secret_key_2026',
      'metrics_secret_key_2026',
    ]
    if (legacyKeys.some((k) => safeEqual(provided, k))) return { ok: true, legacy: true }
  }

  return { ok: false, legacy: false }
}

/** Valida o header x-api-key do upload e registra o resultado no log sem nunca imprimir a chave. */
export function authorizeReleaseUpload(request: { headers: Record<string, any>; ip?: string }): boolean {
  const result = checkReleaseKey(request.headers['x-api-key'])
  if (!result.ok) {
    console.warn(`[Release] Upload REJEITADO: chave inválida (ip ${request.ip || 'desconhecido'}).`)
    return false
  }
  if (result.legacy) {
    console.warn(
      '[Release] Upload autorizado com chave LEGADA. Configure RELEASE_UPLOAD_KEY e depois defina RELEASE_ALLOW_LEGACY_KEYS=false.',
    )
  }
  return true
}

/** SHA-256 do arquivo publicado (para os clientes poderem conferir a integridade). */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
