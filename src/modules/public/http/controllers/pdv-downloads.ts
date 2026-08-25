import { FastifyRequest, FastifyReply } from 'fastify'
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
        const apiKey = request.headers['x-api-key']
        const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
        
        if (apiKey !== validKey && apiKey !== 'metrics_secret_key_2026') {
            return reply.status(401).send({ message: 'Chave de API inválida para upload de release.' })
        }

        ensureDir(DOWNLOADS_DIR)

        const data = await request.file()
        if (!data) {
            return reply.status(400).send({ message: 'Nenhum arquivo enviado.' })
        }

        const version = (data.fields.version as any)?.value || '2.4.0'
        const targetFile = path.join(DOWNLOADS_DIR, 'Instalar_MetricsPDV.exe')

        await pipeline(data.file, fs.createWriteStream(targetFile))

        const versionData = {
            version,
            fileName: 'Instalar_MetricsPDV.exe',
            updatedAt: new Date().toISOString(),
            sizeBytes: fs.statSync(targetFile).size
        }

        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8')

        return reply.status(200).send({
            message: 'Release do Metrics PDV atualizada com sucesso!',
            version: versionData
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao processar upload da release: ' + err.message })
    }
}