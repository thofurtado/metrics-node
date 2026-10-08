import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getAppVersionInfo, OFFICIAL_APPS } from './unified-downloads'

// Data de publicação na Central de Downloads (08/10/2026): a página mostra "Publicado em" só com a data do envio oficial.
describe('Catálogo da Central: data de publicação', () => {
  const downloadsDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'downloads')
  const versionFile = path.join(downloadsDir, 'garcom-version.json')
  let copia: string | null = null

  afterEach(() => {
    if (copia !== null) fs.writeFileSync(versionFile, copia, 'utf8')
    else if (fs.existsSync(versionFile)) fs.unlinkSync(versionFile)
    copia = null
  })

  function guardarOriginal() {
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true })
    copia = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8') : null
  }

  it('devolve a hora do envio oficial', () => {
    guardarOriginal()
    fs.writeFileSync(versionFile, JSON.stringify({ version: '2.1.0', updatedAt: '2026-10-03T11:38:13.028Z' }), 'utf8')
    const info = getAppVersionInfo(OFFICIAL_APPS.garcom)
    expect(info.version).toBe('2.1.0')
    expect(info.publicadoEm).toBe('2026-10-03T11:38:13.028Z')
  })

  it('sem envio oficial: sem data (nunca a hora da consulta)', () => {
    guardarOriginal()
    if (fs.existsSync(versionFile)) fs.unlinkSync(versionFile)
    const info = getAppVersionInfo(OFFICIAL_APPS.garcom)
    expect(info.publicadoEm).toBeNull()
  })
})
