import { FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { sseManager } from '@/lib/sse-manager'
import { authorizeReleaseUpload, sha256File } from '@/lib/release-auth'

const DOWNLOADS_DIR = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'downloads')

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

export interface AppReleaseConfig {
    id: string
    key: string
    name: string
    fileName: string
    defaultVersion: string
    contentType: string
    aliases?: string[]
}

export const OFFICIAL_APPS: Record<string, AppReleaseConfig> = {
    sync: {
        id: 'metrics-sync',
        key: 'sync',
        name: 'Metrics Sync - Importação & Sincronização Legada',
        fileName: 'Metrics_Sync_Setup.exe',
        defaultVersion: '1.3.2.5',
        contentType: 'application/octet-stream',
        aliases: ['metricssync', 'metrics-sync']
    },
    ponto: {
        id: 'metrics-ponto',
        key: 'ponto',
        name: 'Metrics Ponto - Ponto Eletrônico & Gestão',
        fileName: 'Metrics_Ponto_Setup.exe',
        defaultVersion: '1.2.0',
        contentType: 'application/octet-stream',
        aliases: ['metricsponto', 'metrics-ponto']
    },
    windy: {
        id: 'metrics-windy',
        key: 'windy',
        name: 'Metrics Windy - Agente de Telemetria & Suporte',
        fileName: 'Metrics_Windy_Setup.exe',
        defaultVersion: '2.3.2.4',
        contentType: 'application/octet-stream',
        aliases: ['metricswindy', 'metrics-windy']
    },
    pdv: {
        id: 'metrics-pdv',
        key: 'pdv',
        name: 'Metrics PDV - Frente de Caixa & Emissor Fiscal',
        fileName: 'Instalar_MetricsPDV.exe',
        defaultVersion: '2.4.1',
        contentType: 'application/octet-stream',
        aliases: ['metricspdv', 'metrics-pdv']
    },
    mobile: {
        id: 'metrics-mobile',
        key: 'mobile',
        name: 'Metrics Mobile - Comanda & Gestão Móvel',
        fileName: 'metrics-mobile.apk',
        defaultVersion: '2.0.0',
        contentType: 'application/vnd.android.package-archive',
        aliases: ['metricsmobile', 'metrics-mobile']
    },
    garcom: {
        id: 'metrics-garcom',
        key: 'garcom',
        name: 'Metrics Garçom - Atendimento LAN & Mesas',
        fileName: 'metrics-garcom.apk',
        defaultVersion: '2.0.0',
        contentType: 'application/vnd.android.package-archive',
        aliases: ['metricsgarcom', 'metrics-garcom']
    }
}

function resolveAppConfig(param: string): AppReleaseConfig | null {
    if (!param) return null
    const lower = param.toLowerCase().trim()
    if (OFFICIAL_APPS[lower]) return OFFICIAL_APPS[lower]

    for (const key of Object.keys(OFFICIAL_APPS)) {
        const cfg = OFFICIAL_APPS[key]
        if (cfg.id === lower || cfg.fileName.toLowerCase() === lower || cfg.aliases?.includes(lower)) {
            return cfg
        }
    }
    return null
}

function getAppVersionInfo(cfg: AppReleaseConfig) {
    ensureDir(DOWNLOADS_DIR)
    const versionFile = path.join(DOWNLOADS_DIR, `${cfg.key}-version.json`)
    let info = {
        id: cfg.id,
        key: cfg.key,
        name: cfg.name,
        version: cfg.defaultVersion,
        fileName: cfg.fileName,
        downloadUrl: `https://api.metrics.dev.br/api/public/${cfg.key}/download`,
        updatedAt: new Date().toISOString(),
        fileSizeBytes: 0,
        formattedSize: ''
    }

    if (fs.existsSync(versionFile)) {
        try {
            const raw = fs.readFileSync(versionFile, 'utf8')
            info = { ...info, ...JSON.parse(raw) }
        } catch { }
    }

    const filePath = path.join(DOWNLOADS_DIR, info.fileName || cfg.fileName)
    if (fs.existsSync(filePath)) {
        info.fileSizeBytes = fs.statSync(filePath).size
        const mb = (info.fileSizeBytes / (1024 * 1024)).toFixed(1)
        info.formattedSize = `${mb} MB`
    } else {
        info.formattedSize = 'Disponível na nuvem'
    }

    info.downloadUrl = `https://api.metrics.dev.br/api/public/${cfg.key}/download`
    return info
}

export async function getAppsCatalog(request: FastifyRequest, reply: FastifyReply) {
    try {
        const catalog = Object.keys(OFFICIAL_APPS).map(key => {
            const cfg = OFFICIAL_APPS[key]
            return getAppVersionInfo(cfg)
        })

        return reply.status(200).send({
            updatedAt: new Date().toISOString(),
            apps: catalog
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao gerar catálogo de downloads: ' + err.message })
    }
}

export async function getAppLatestVersion(request: FastifyRequest<{ Params: { app: string } }>, reply: FastifyReply) {
    try {
        const { app } = request.params
        const cfg = resolveAppConfig(app)
        if (!cfg) {
            return reply.status(404).send({ message: `Aplicativo '${app}' não encontrado no registro oficial.` })
        }

        const info = getAppVersionInfo(cfg)
        return reply.status(200).send(info)
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao obter versão: ' + err.message })
    }
}

export async function downloadApp(request: FastifyRequest<{ Params: { app: string } }>, reply: FastifyReply) {
    try {
        const { app } = request.params
        const cfg = resolveAppConfig(app)
        if (!cfg) {
            return reply.status(404).send({ message: `Aplicativo '${app}' não encontrado.` })
        }

        ensureDir(DOWNLOADS_DIR)
        const filePath = path.join(DOWNLOADS_DIR, cfg.fileName)

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            reply.header('Content-Length', stat.size)
            reply.header('Content-Type', cfg.contentType)
            reply.header('Content-Disposition', `attachment; filename="${cfg.fileName}"`)

            const stream = fs.createReadStream(filePath)
            return reply.send(stream)
        }

        return reply.status(404).send({
            message: `O instalador do ${cfg.name} está sendo sincronizado na nuvem. Tente novamente em instantes.`
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Erro ao transferir instalador: ' + err.message })
    }
}

export async function uploadAppRelease(request: FastifyRequest<{ Params: { app: string } }>, reply: FastifyReply) {
    try {
        if (!authorizeReleaseUpload(request)) {
            return reply.status(401).send({ message: 'Chave de API inválida para upload de release.' })
        }

        const { app } = request.params
        const cfg = resolveAppConfig(app)
        if (!cfg) {
            return reply.status(400).send({ message: `Aplicativo '${app}' inválido para release.` })
        }

        ensureDir(DOWNLOADS_DIR)

        const data = await request.file({
            limits: { fileSize: 800 * 1024 * 1024 }
        })

        if (!data) {
            return reply.status(400).send({ message: 'Nenhum arquivo enviado no formulário multipart.' })
        }

        const versionField = ((data.fields?.version as any)?.value as string) || (request.query && (request.query as any).version) || cfg.defaultVersion
        const cleanVersion = versionField.replace(/^[vV]/, '').trim()

        const targetFile = path.join(DOWNLOADS_DIR, cfg.fileName)
        await pipeline(data.file, fs.createWriteStream(targetFile))

        const sizeBytes = fs.statSync(targetFile).size
        const sha256 = await sha256File(targetFile)
        const versionData = {
            id: cfg.id,
            key: cfg.key,
            name: cfg.name,
            version: cleanVersion,
            fileName: cfg.fileName,
            downloadUrl: `https://api.metrics.dev.br/api/public/${cfg.key}/download`,
            updatedAt: new Date().toISOString(),
            fileSizeBytes: sizeBytes,
            formattedSize: `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
            sha256
        }

        const versionFile = path.join(DOWNLOADS_DIR, `${cfg.key}-version.json`)
        fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2), 'utf8')

        // Se for PDV, dispara evento SSE para auto-update dos caixas conectados
        if (cfg.key === 'pdv') {
            try {
                sseManager.broadcast('remote_update', {
                    version: versionData.version,
                    downloadUrl: versionData.downloadUrl,
                    mandatory: true,
                    updatedAt: versionData.updatedAt
                })
            } catch { }
        }

        return reply.status(200).send({
            message: `Release de ${cfg.name} (v${cleanVersion}) publicada com sucesso!`,
            ...versionData
        })
    } catch (err: any) {
        return reply.status(500).send({ message: 'Falha no processamento do upload: ' + err.message })
    }
}