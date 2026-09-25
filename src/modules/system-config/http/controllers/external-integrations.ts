import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { consultarNcm, limparCacheIbpt, mascararToken, normalizarCnpj, normalizarUf, NCM_DE_TESTE } from '../../services/ibpt'
import {
  lerIntegracao, salvarIntegracao, TabelaDeIntegracoesAusente, PROVEDOR_FOOD99, PROVEDOR_IBPT,
} from '../../services/tenant-integrations'

// Aba "Integrações" das Configurações da web (25/09/2026): iFood, 99Food e De Olho no Imposto (IBPT).
// Cada serviço salva só o que é dele. Não usar PUT /settings/company-profile aqui: ele regrava bairros e setores.

async function perfil() {
  return prisma.companyProfile.findFirst({
    select: { id: true, document: true, state: true, ifoodMerchantId: true, ifoodAccessToken: true, ifoodTokenExpiresAt: true },
  })
}

function visaoIbpt(linha: any, empresa: Awaited<ReturnType<typeof perfil>>) {
  const settings = (linha?.settings && typeof linha.settings === 'object') ? linha.settings : {}
  return {
    configurado: Boolean(linha?.secret),
    ativo: Boolean(linha?.enabled && linha?.secret),
    cnpj: normalizarCnpj(settings.cnpj) ?? normalizarCnpj(empresa?.document) ?? '',
    tokenMascarado: mascararToken(linha?.secret),
    ultimoTeste: settings.ultimoTeste ?? null,
    atualizadoEm: linha?.updated_at ?? null,
  }
}

export async function getExternalIntegrations(request: FastifyRequest, reply: FastifyReply) {
  const empresa = await perfil()
  let tabelaPronta = true
  let ibpt: any = null
  let food99: any = null
  try {
    ibpt = await lerIntegracao(prisma, PROVEDOR_IBPT)
    food99 = await lerIntegracao(prisma, PROVEDOR_FOOD99)
  } catch (err) {
    if (!(err instanceof TabelaDeIntegracoesAusente)) throw err
    tabelaPronta = false
  }
  return reply.send({
    tabelaPronta,
    empresa: { cnpj: normalizarCnpj(empresa?.document) ?? '', uf: normalizarUf(empresa?.state) ?? '' },
    ibpt: visaoIbpt(ibpt, empresa),
    ifood: {
      merchantId: empresa?.ifoodMerchantId ?? '',
      conectado: Boolean(empresa?.ifoodAccessToken),
      tokenExpiraEm: empresa?.ifoodTokenExpiresAt ?? null,
    },
    food99: { shopId: String((food99?.settings as any)?.shopId ?? '') },
  })
}

export async function updateIbptIntegration(request: FastifyRequest, reply: FastifyReply) {
  const corpo = z.object({
    ativo: z.boolean(),
    cnpj: z.string().optional(),
    // ausente = mantém o token atual; vazio ou null = apaga
    token: z.string().nullable().optional(),
  }).parse(request.body)

  try {
    const atual = await lerIntegracao(prisma, PROVEDOR_IBPT)
    const empresa = await perfil()
    const token = corpo.token === undefined ? (atual?.secret ?? null) : (corpo.token?.trim() || null)
    const cnpj = normalizarCnpj(corpo.cnpj) ?? normalizarCnpj((atual?.settings as any)?.cnpj) ?? normalizarCnpj(empresa?.document)

    if (corpo.ativo && !token) {
      return reply.status(400).send({ message: 'Cole o token gerado no site De Olho no Imposto para ativar.' })
    }
    if (corpo.ativo && !cnpj) {
      return reply.status(400).send({ message: 'Informe o CNPJ da empresa cadastrada no De Olho no Imposto (14 números).' })
    }

    // Testa antes de salvar: token e CNPJ andam juntos no IBPT.
    let ultimoTeste: Record<string, unknown> | null = (atual?.settings as any)?.ultimoTeste ?? null
    let aviso: string | null = null
    if (corpo.ativo && token && cnpj) {
      limparCacheIbpt()
      const uf = normalizarUf(empresa?.state) ?? 'SP'
      const teste = await consultarNcm(token, cnpj, uf, NCM_DE_TESTE)
      if (teste.status === 'recusado') {
        return reply.status(400).send({ message: `O IBPT não aceitou esse token com o CNPJ ${cnpj}: ${teste.mensagem}` })
      }
      if (teste.status === 'ok') {
        ultimoTeste = {
          em: new Date().toISOString(), uf, ncm: NCM_DE_TESTE,
          federal: teste.aliquota.nacionalFederal, estadual: teste.aliquota.estadual, municipal: teste.aliquota.municipal,
          versao: teste.aliquota.versao, vigenciaFim: teste.aliquota.vigenciaFim,
        }
      } else if (teste.status === 'erro') {
        aviso = `Salvo, mas não deu para testar agora (${teste.mensagem}). O PDV tenta de novo sozinho.`
      }
    }

    const linha = await salvarIntegracao(prisma, PROVEDOR_IBPT, {
      enabled: corpo.ativo,
      secret: token,
      settings: { cnpj, ultimoTeste },
    })
    return reply.send({
      message: aviso ?? (corpo.ativo ? 'De Olho no Imposto ativado e testado.' : 'De Olho no Imposto desativado.'),
      aviso: Boolean(aviso),
      ibpt: visaoIbpt(linha, empresa),
    })
  } catch (err) {
    if (err instanceof TabelaDeIntegracoesAusente) return reply.status(503).send({ message: err.message })
    throw err
  }
}

export async function updateIfoodMerchant(request: FastifyRequest, reply: FastifyReply) {
  const { merchantId } = z.object({ merchantId: z.string().nullable() }).parse(request.body)
  const empresa = await perfil()
  if (!empresa) return reply.status(400).send({ message: 'Salve antes os dados da loja em "Meu Cardápio (White Label)".' })
  await prisma.companyProfile.update({ where: { id: empresa.id }, data: { ifoodMerchantId: merchantId?.trim() || null } })
  return reply.send({ message: 'ID da loja no iFood salvo.', merchantId: merchantId?.trim() || '' })
}

export async function updateFood99Shop(request: FastifyRequest, reply: FastifyReply) {
  const { shopId } = z.object({ shopId: z.string().nullable() }).parse(request.body)
  try {
    const valor = shopId?.trim() || ''
    await salvarIntegracao(prisma, PROVEDOR_FOOD99, { enabled: Boolean(valor), settings: { shopId: valor } })
    return reply.send({ message: 'ID da loja na 99Food salvo.', shopId: valor })
  } catch (err) {
    if (err instanceof TabelaDeIntegracoesAusente) return reply.status(503).send({ message: err.message })
    throw err
  }
}
