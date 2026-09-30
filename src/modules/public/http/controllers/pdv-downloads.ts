
import { authorizeReleaseUpload, sha256File } from '@/lib/release-auth'
﻿import { FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'

const DOWNLOADS_DIR = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'downloads')
const VERSION_FILE = path.join(DOWNLOADS_DIR, 'pdv-version.json')

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

export async function getLatestPdvVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
        ensureDir(DOWNLOADS_DIR)
        
        let versionInfo = {
            version: '2.4.0',
            downloadUrl: 'https://api.metrics.dev.br/api/public/pdv/download',
            updatedAt: new Date().toISOString(),
            fileName: 'Instalar_MetricsPDV.exe'
        }

        if (fs.existsSync(VERSION_FILE)) {
            try {
                const data = fs.readFileSync(VERSION_FILE, 'utf8')
                versionInfo = { ...versionInfo, ...JSON.parse(data) }
            } catch { }
        }

        const filePath = path.join(DOWNLOADS_DIR, versionInfo.fileName || 'Instalar_MetricsPDV.exe')
        let fileSizeBytes = 0
        if (fs.existsSync(filePath)) {
            fileSizeBytes = fs.statSync(filePath).size
        }

        return reply.status(200).send({
            ...versionInfo,
            downloadUrl: 'https://api.metrics.dev.br/api/public/pdv/download',
            fileSizeBytes
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao buscar versão do PDV: ' + err.message })
    }
}

export async function downloadLatestPdv(request: FastifyRequest, reply: FastifyReply) {
    try {
        ensureDir(DOWNLOADS_DIR)
        const filePath = path.join(DOWNLOADS_DIR, 'Instalar_MetricsPDV.exe')

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            reply.header('Content-Length', stat.size)
            reply.header('Content-Type', 'application/octet-stream')
            reply.header('Content-Disposition', 'attachment; filename="Instalar_MetricsPDV.exe"')

            const stream = fs.createReadStream(filePath)
            return reply.send(stream)
        }

        return reply.status(404).send({ message: 'Instalador do Metrics PDV sendo sincronizado. Tente novamente em instantes.' })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao baixar o instalador do PDV: ' + err.message })
    }
}

export async function uploadPdvRelease(request: FastifyRequest, reply: FastifyReply) {
    try {
        if (!authorizeReleaseUpload(request)) {
            return reply.status(401).send({ message: 'Chave de API inválida para upload de release.' })
        }

        ensureDir(DOWNLOADS_DIR)

        const data = await request.file()
        if (!data) {
            return reply.status(400).send({ message: 'Nenhum arquivo enviado.' })
        }

        const version = (data.fields.version as any)?.value || '2.4.0'
        const cleanVersion = String(version).replace(/^[vV]/, '').trim()
        const targetFile = path.join(DOWNLOADS_DIR, 'Instalar_MetricsPDV.exe')
        const tempFile = path.join(DOWNLOADS_DIR, `Instalar_MetricsPDV.exe.tmp-${Date.now()}`)

        // 1. Gravar no arquivo temporário primeiro (upload atômico)
        await pipeline(data.file, fs.createWriteStream(tempFile))
        const sha256 = await sha256File(tempFile)
        const sizeBytes = fs.statSync(tempFile).size

        // 2. Antes de trocar, guardar o instalador anterior como Instalar_MetricsPDV_<versão-anterior>.exe (manter os 3 últimos)
        if (fs.existsSync(targetFile)) {
            let oldVersion = 'anterior'
            if (fs.existsSync(VERSION_FILE)) {
                try {
                    const oldData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'))
                    if (oldData.version) {
                        oldVersion = String(oldData.version).replace(/^[vV]/, '').trim()
                    }
                } catch { }
            }

            const backupFile = path.join(DOWNLOADS_DIR, `Instalar_MetricsPDV_${oldVersion}.exe`)
            try {
                fs.copyFileSync(targetFile, backupFile)
            } catch (copyErr) {
                console.error('[PDV Release] Erro ao criar backup do instalador anterior:', copyErr)
            }

            // Manter os 3 últimos backups
            try {
                const files = fs.readdirSync(DOWNLOADS_DIR)
                const backups = files
                    .filter(f => f.startsWith('Instalar_MetricsPDV_') && f.endsWith('.exe') && f !== 'Instalar_MetricsPDV.exe')
                    .map(f => {
                        const p = path.join(DOWNLOADS_DIR, f)
                        return { name: f, path: p, mtime: fs.statSync(p).mtimeMs }
                    })
                    .sort((a, b) => b.mtime - a.mtime)

                if (backups.length > 3) {
                    for (const b of backups.slice(3)) {
                        try { fs.unlinkSync(b.path) } catch { }
                    }
                }
            } catch (cleanErr) {
                console.error('[PDV Release] Erro ao limpar backups antigos:', cleanErr)
            }
        }

        // 3. Renomear o temporário para o oficial (atômico)
        fs.renameSync(tempFile, targetFile)

        // 4. Gravar o manifesto da versão APÓS a troca bem sucedida
        const versionData = {
            version: cleanVersion,
            sha256,
            fileName: 'Instalar_MetricsPDV.exe',
            updatedAt: new Date().toISOString(),
            sizeBytes
        }

        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8')

        // U0: Removido o disparo automático de remote_update para evitar derrubar clientes em operação

        return reply.status(200).send({
            message: 'Release do Metrics PDV atualizada com sucesso!',
            version: versionData
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao processar upload da release: ' + err.message })
    }
}
