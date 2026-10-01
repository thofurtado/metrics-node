import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// Criar despesa a partir de um comprovante da lista "Comprovantes" (01/10/2026, caso Marujo): o comprovante sai da lista
// antes de a despesa existir; já usado = a despesa nem é criada; despesa não criada = o comprovante volta para a lista.

const estado = vi.hoisted(() => ({
    pasta: '',
    anexos: new Map<string, string>(),
    execute: null as any,
}))

vi.mock('@/modules/financial/use-cases/factories/make-transaction-use-case', () => ({
    MakeTransactionUseCase: () => ({ execute: (...a: any[]) => estado.execute(...a) }),
}))

vi.mock('@/modules/uploads/http/controllers/upload', () => ({
    pastaDeComprovantes: () => estado.pasta,
    anexoDaDespesa: () => ({
        storage: {
            save: async (_b: Buffer, pasta: string, ext: string) => `/uploads/t/${pasta}/anexo${ext}`,
            delete: async () => { },
        },
        buscarAnexoAtual: async (id: string) => estado.anexos.get(id) ?? null,
        gravarAnexo: async (id: string, url: string) => { estado.anexos.set(id, url) },
    }),
}))

import { createTransaction } from '@/modules/financial/http/controllers/transaction'

const NOME = '1759330000000_meta_eyJkIjoiYWRlZ2FvIDAzIn0.jpg'

function resposta() {
    const r: any = { code: 200, body: undefined }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: unknown) => { r.body = b; return r }
    return r
}

function envio(extra: Record<string, unknown> = {}) {
    return { body: { operation: 'expense', amount: 596.5, account_id: 'conta-central', description: 'adegao 03', ...extra } } as any
}

async function naLista() {
    return (await fs.readdir(estado.pasta)).filter((f) => !f.startsWith('_'))
}

describe('Criar despesa a partir do comprovante', () => {
    beforeEach(async () => {
        estado.pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'comprovantes-'))
        await fs.writeFile(path.join(estado.pasta, NOME), 'foto')
        estado.anexos = new Map()
        let n = 0
        estado.execute = vi.fn(async () => ({ transaction: { id: `despesa-${++n}` } }))
    })

    afterEach(async () => {
        await fs.rm(estado.pasta, { recursive: true, force: true })
    })

    it('cria a despesa, anexa o comprovante e ele sai da lista', async () => {
        const r = resposta()
        await createTransaction(envio({ receipt_filename: NOME }), r)
        expect(r.code).toBe(200)
        expect(r.body.receipt_linked).toBe(true)
        expect(estado.anexos.get('despesa-1')).toBe('/uploads/t/transactions/anexo.jpg')
        expect(await naLista()).toEqual([])
    })

    it('o mesmo comprovante enviado de novo: recusa e NÃO cria a 2ª despesa', async () => {
        await createTransaction(envio({ receipt_filename: NOME }), resposta())
        const r = resposta()
        await createTransaction(envio({ receipt_filename: NOME }), r)
        expect(r.code).toBe(409)
        expect(r.body.message).toMatch(/já foi usado/)
        expect(estado.execute).toHaveBeenCalledTimes(1)
    })

    it('se a despesa não puder ser criada, o comprovante volta para a lista', async () => {
        estado.execute = vi.fn(async () => { throw new Error('Conta inválida') })
        const r = resposta()
        await createTransaction(envio({ receipt_filename: NOME }), r)
        expect(r.code).toBe(409)
        expect(await naLista()).toEqual([NOME])
    })

    it('despesa sem comprovante continua igual (não mexe na lista)', async () => {
        const r = resposta()
        await createTransaction(envio(), r)
        expect(r.code).toBe(200)
        expect(r.body.receipt_linked).toBeUndefined()
        expect(await naLista()).toEqual([NOME])
    })
})
