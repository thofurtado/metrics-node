import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { sseManager } from '@/lib/sse-manager'
import { prisma } from '@/lib/prisma'
import { connectionManager } from '@/modules/equipments/ws/connection-manager'
import { sendCommand } from '@/modules/equipments/http/controllers/send-command'
import { uploadPdvRelease } from './pdv-downloads'
import * as releaseAuth from '@/lib/release-auth'

describe('U0: Desarmar auto-update forçado, Upload Atômico e Validação de Loja em Comandos', () => {
  const downloadsDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'downloads')
  const targetFile = path.join(downloadsDir, 'Instalar_MetricsPDV.exe')
  const versionFile = path.join(downloadsDir, 'pdv-version.json')

  beforeEach(() => {
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true })
    }
    const files = fs.readdirSync(downloadsDir)
    for (const f of files) {
      if (f.startsWith('Instalar_MetricsPDV') || f === 'pdv-version.json' || f.startsWith('temp_test')) {
        try { fs.unlinkSync(path.join(downloadsDir, f)) } catch {}
      }
    }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    const files = fs.existsSync(downloadsDir) ? fs.readdirSync(downloadsDir) : []
    for (const f of files) {
      if (f.startsWith('temp_test')) {
        try { fs.unlinkSync(path.join(downloadsDir, f)) } catch {}
      }
    }
  })

  it('U0.a: Não deve disparar remote_update via SSE ao fazer upload de release do PDV', async () => {
    const broadcastSpy = vi.spyOn(sseManager, 'notifyTenant')
    vi.spyOn(releaseAuth, 'authorizeReleaseUpload').mockReturnValue(true)

    const dummyFilePath = path.join(downloadsDir, 'temp_test_dummy.exe')
    fs.writeFileSync(dummyFilePath, 'dummy binary content for pdv')

    const mockRequest: any = {
      file: async () => ({
        fields: { version: { value: '2.4.38' } },
        file: fs.createReadStream(dummyFilePath),
      }),
    }

    const mockReply: any = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await uploadPdvRelease(mockRequest, mockReply)

    expect(mockReply.status).toHaveBeenCalledWith(200)
    expect(broadcastSpy).not.toHaveBeenCalled()
  })

  it('U0.b: Upload do PDV deve ser atômico e manter backup das 3 últimas versões anteriores', async () => {
    vi.spyOn(releaseAuth, 'authorizeReleaseUpload').mockReturnValue(true)

    fs.writeFileSync(targetFile, 'v2.4.35 content')
    fs.writeFileSync(versionFile, JSON.stringify({ version: '2.4.35', fileName: 'Instalar_MetricsPDV.exe' }))

    const dummyUpload1 = path.join(downloadsDir, 'temp_test_1.bin')
    fs.writeFileSync(dummyUpload1, 'v2.4.36 content')
    await uploadPdvRelease({
      file: async () => ({
        fields: { version: { value: '2.4.36' } },
        file: fs.createReadStream(dummyUpload1),
      }),
    } as any, { status: vi.fn().mockReturnThis(), send: vi.fn() } as any)

    expect(fs.existsSync(path.join(downloadsDir, 'Instalar_MetricsPDV_2.4.35.exe'))).toBe(true)

    const dummyUpload2 = path.join(downloadsDir, 'temp_test_2.bin')
    fs.writeFileSync(dummyUpload2, 'v2.4.37 content')
    await uploadPdvRelease({
      file: async () => ({
        fields: { version: { value: '2.4.37' } },
        file: fs.createReadStream(dummyUpload2),
      }),
    } as any, { status: vi.fn().mockReturnThis(), send: vi.fn() } as any)

    expect(fs.existsSync(path.join(downloadsDir, 'Instalar_MetricsPDV_2.4.36.exe'))).toBe(true)

    const dummyUpload3 = path.join(downloadsDir, 'temp_test_3.bin')
    fs.writeFileSync(dummyUpload3, 'v2.4.38 content')
    await uploadPdvRelease({
      file: async () => ({
        fields: { version: { value: '2.4.38' } },
        file: fs.createReadStream(dummyUpload3),
      }),
    } as any, { status: vi.fn().mockReturnThis(), send: vi.fn() } as any)

    expect(fs.existsSync(path.join(downloadsDir, 'Instalar_MetricsPDV_2.4.37.exe'))).toBe(true)

    const dummyUpload4 = path.join(downloadsDir, 'temp_test_4.bin')
    fs.writeFileSync(dummyUpload4, 'v2.4.39 content')
    await uploadPdvRelease({
      file: async () => ({
        fields: { version: { value: '2.4.39' } },
        file: fs.createReadStream(dummyUpload4),
      }),
    } as any, { status: vi.fn().mockReturnThis(), send: vi.fn() } as any)

    const files = fs.readdirSync(downloadsDir)
    const backups = files.filter(f => f.startsWith('Instalar_MetricsPDV_') && f.endsWith('.exe') && f !== 'Instalar_MetricsPDV.exe')
    expect(backups.length).toBe(3)
  })

  it('U0.c: POST /equipments/:id/command deve retornar 404 se o equipamento não pertencer à loja/tenant', async () => {
    vi.spyOn(prisma.equipment, 'findUnique').mockResolvedValue(null as any)
    const sendCommandSpy = vi.spyOn(connectionManager, 'sendCommand')

    const mockRequest: any = {
      params: { id: '00000000-0000-0000-0000-000000000001' },
      body: { command: 'ATUALIZAR_PDV' },
    }

    const mockReply: any = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await sendCommand(mockRequest, mockReply)

    expect(mockReply.status).toHaveBeenCalledWith(404)
    expect(mockReply.send).toHaveBeenCalledWith({ message: 'Equipamento não encontrado' })
    expect(sendCommandSpy).not.toHaveBeenCalled()
  })

  it('U0.c: POST /equipments/:id/command deve enviar comando quando o equipamento pertencer à loja', async () => {
    vi.spyOn(prisma.equipment, 'findUnique').mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      identification: 'Caixa 1',
    } as any)
    vi.spyOn(connectionManager, 'sendCommand').mockReturnValue(true)

    const mockRequest: any = {
      params: { id: '00000000-0000-0000-0000-000000000001' },
      body: { command: 'ATUALIZAR_PDV' },
    }

    const mockReply: any = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await sendCommand(mockRequest, mockReply)

    expect(mockReply.status).toHaveBeenCalledWith(200)
    expect(mockReply.send).toHaveBeenCalledWith({ message: 'Comando enviado com sucesso.' })
  })
})
