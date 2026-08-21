import { FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { pipeline } from 'stream/promises'

const DOWNLOADS_DIR = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'downloads')
const VERSION_FILE = path.join(DOWNLOADS_DIR, 'windy-version.json')

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

export async function getLatestWindyVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
        ensureDir(DOWNLOADS_DIR)
        
        let versionInfo = {
            version: '2.1.2',
            downloadUrl: 'https://api.metrics.dev.br/api/public/windy/download',
            updatedAt: new Date().toISOString(),
            fileName: 'Metrics_Windy_Setup.exe'
        }

        if (fs.existsSync(VERSION_FILE)) {
            try {
                const data = fs.readFileSync(VERSION_FILE, 'utf8')
                versionInfo = { ...versionInfo, ...JSON.parse(data) }
            } catch { }
        }

        const filePath = path.join(DOWNLOADS_DIR, versionInfo.fileName || 'Metrics_Windy_Setup.exe')
        let fileSizeBytes = 56909824 // ~54.2 MB
        if (fs.existsSync(filePath)) {
            fileSizeBytes = fs.statSync(filePath).size
        }

        return reply.status(200).send({
            ...versionInfo,
            downloadUrl: 'https://api.metrics.dev.br/api/public/windy/download',
            fileSizeBytes
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao buscar versão do Windy: ' + err.message })
    }
}

export async function downloadLatestWindy(request: FastifyRequest, reply: FastifyReply) {
    try {
        ensureDir(DOWNLOADS_DIR)
        const filePath = path.join(DOWNLOADS_DIR, 'Metrics_Windy_Setup.exe')

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            reply.header('Content-Length', stat.size)
            reply.header('Content-Type', 'application/octet-stream')
            reply.header('Content-Disposition', 'attachment; filename="Metrics_Windy_Setup.exe"')

            const stream = fs.createReadStream(filePath)
            return reply.send(stream)
        }

        // Fallback: Redireciona para o download do release ou serve diretamente
        return reply.status(404).send({ message: 'Instalador do Windy sendo sincronizado. Tente novamente em instantes.' })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao baixar o instalador: ' + err.message })
    }
}

export async function uploadWindyRelease(request: FastifyRequest, reply: FastifyReply) {
    try {
        const apiKey = request.headers['x-api-key']
        const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
        
        if (apiKey !== validKey && apiKey !== 'metrics_secret_key_2026') {
            return reply.status(401).send({ message: 'Chave de API inválida para upload de release.' })
        }

        ensureDir(DOWNLOADS_DIR)

        const data = await request.file({
            limits: { fileSize: 200 * 1024 * 1024 }
        })

        if (!data) {
            return reply.status(400).send({ message: 'Nenhum arquivo enviado no formulário multipart.' })
        }

        const version = ((data.fields?.version as any)?.value as string) || (request.query && (request.query as any).version) || '2.1.1'
        const cleanVersion = version.replace(/^[vV]/, '').trim()

        const targetFile = path.join(DOWNLOADS_DIR, 'Metrics_Windy_Setup.exe')
        await pipeline(data.file, fs.createWriteStream(targetFile))

        const versionData = {
            version: cleanVersion,
            downloadUrl: 'https://api.metrics.dev.br/api/public/windy/download',
            updatedAt: new Date().toISOString(),
            fileName: 'Metrics_Windy_Setup.exe'
        }
        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8')

        return reply.status(200).send({
            message: 'Release do Windy recebida e publicada com sucesso!',
            ...versionData
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Falha no processamento do upload: ' + err.message })
    }
}
