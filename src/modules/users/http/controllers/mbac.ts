import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// ─── Mapeamento canônico slug → coluna do system_config ──────────────────────
// Deve estar sincronizado com o SYSTEM_CONFIG_TO_SLUG do frontend
const SLUG_TO_SYSTEM_CONFIG: Record<string, string> = {
    items:    'merchandise_module',
    finance:  'financial_module',
    service:  'treatments_module',
    hr:       'hr_module',
    settings: null as any, // settings não tem restrição de instância
}

export async function fetchAllModules(request: FastifyRequest, reply: FastifyReply) {
    const modules = await prisma.module.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
        }
    })
    return reply.status(200).send({ modules })
}

export async function fetchUsersWithModules(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            pin_hash: true,
            userModules: {
                select: {
                    module: {
                        select: {
                            slug: true,
                            id: true
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    const formattedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        has_pin: !!user.pin_hash,
        modules: user.userModules.map(um => um.module.slug)
    }))

    return reply.status(200).send({ users: formattedUsers })
}

export async function updateUserModules(request: FastifyRequest, reply: FastifyReply) {
    console.log('➡️ [MBAC] PUT /users/:id/modules received:', {
        params: request.params,
        body: request.body,
    })

    // ── 1. Validação do payload ───────────────────────────────────────────────
    const updateUserModulesParams = z.object({
        id: z.string().uuid('ID de usuário inválido — deve ser UUID')
    })
    const updateUserModulesBody = z.object({
        modules: z.array(z.string()).default([])
    })

    let id: string
    let requestedSlugs: string[]

    try {
        const parsedParams = updateUserModulesParams.parse(request.params)
        const parsedBody   = updateUserModulesBody.parse(request.body)
        id             = parsedParams.id
        requestedSlugs = parsedBody.modules
    } catch (e: any) {
        console.error('❌ [MBAC] Zod Validation Error:', JSON.stringify(e?.errors, null, 2))
        return reply.status(400).send({
            message: 'Payload inválido. Verifique os dados enviados.',
            errors: e?.errors,
        })
    }

    console.log('📋 [MBAC] Slugs solicitados:', requestedSlugs)

    // ── 2. Auto-lock: impede admin de remover o próprio acesso a Settings ────
    // Só bloqueia se o próprio usuário JÁ TINHA settings e está tentando remover
    if (request.user && id === request.user.sub) {
        const currentModules = await prisma.userModule.findMany({
            where: { user_id: id },
            include: { module: { select: { slug: true } } }
        })
        const hadSettings = currentModules.some(um => um.module.slug === 'settings')
        if (hadSettings && !requestedSlugs.includes('settings')) {
            return reply.status(400).send({
                message: 'Acesso Negado: Você não pode remover sua própria permissão de Configurações.',
            })
        }
    }

    // ── 3. Validação cruzada com system_config ────────────────────────────────
    const systemConfig = await prisma.systemConfig.findFirst()
    console.log('🔧 [MBAC] Config da Instância:', systemConfig)

    const allowedSlugs = requestedSlugs.filter(slug => {
        const configKey = SLUG_TO_SYSTEM_CONFIG[slug]
        // Slug sem restrição de instância (ex: settings) → sempre permitido
        if (configKey === null) return true
        // Slug desconhecido → rejeita
        if (!configKey) {
            console.warn(`⚠️ [MBAC] Slug desconhecido ignorado: "${slug}"`)
            return false
        }
        // Verifica se a instância ativou este módulo
        const isActiveInInstance = (systemConfig as any)?.[configKey] === true
        if (!isActiveInInstance) {
            console.warn(`⚠️ [MBAC] Módulo "${slug}" desabilitado no system_config (${configKey}=false). Ignorado.`)
        }
        return isActiveInInstance
    })

    console.log('✅ [MBAC] Slugs permitidos após validação cruzada:', allowedSlugs)

    // ── 4. Resolve os IDs de módulo a partir dos slugs aprovados ─────────────
    const dbModules = await prisma.module.findMany({
        where: { slug: { in: allowedSlugs } },
        select: { id: true, slug: true }
    })

    const moduleIds = dbModules.map(m => m.id)
    console.log('🔑 [MBAC] Module IDs resolvidos:', dbModules.map(m => `${m.slug} → ${m.id}`))

    // ── 5. Transação atômica: apaga e reinsere ────────────────────────────────
    try {
        await prisma.$transaction([
            prisma.userModule.deleteMany({
                where: { user_id: id }
            }),
            prisma.userModule.createMany({
                data: moduleIds.map((moduleId: string) => ({
                    user_id: id,
                    module_id: moduleId,
                }))
            })
        ])
    } catch (e: any) {
        console.error('❌ [MBAC] Erro na transação Prisma:', e)
        return reply.status(500).send({ message: 'Erro ao salvar permissões no banco de dados.' })
    }

    console.log(`✅ [MBAC] Permissões do usuário ${id} atualizadas com sucesso.`)
    return reply.status(204).send()
}
