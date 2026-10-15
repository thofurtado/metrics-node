import { describe, it, expect, vi } from 'vitest'
import { verifyUserRole } from './verify-user-role'

// Fase 0 do Mergulho (17:U7, 18:S9): a trava de ADMIN não pode mais ser passada com a chave x-api-key
// (que está escrita no app de Ponto); exige um usuário logado com papel ADMIN de verdade.
function fakeReply() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

describe('verifyUserRole', () => {
    it('recusa quem tem a chave x-api-key mas não é admin logado', async () => {
        const mw = verifyUserRole('ADMIN')
        const req: any = { headers: { 'x-api-key': 'metrics_secret_key_2026' }, user: undefined }
        const reply = fakeReply()
        await mw(req, reply)
        expect(reply.code).toBe(401)
    })

    it('recusa usuário logado sem papel ADMIN', async () => {
        const mw = verifyUserRole('ADMIN')
        const req: any = { headers: {}, user: { sub: 'u1', role: 'CASHIER' } }
        const reply = fakeReply()
        await mw(req, reply)
        expect(reply.code).toBe(403)
    })

    it('deixa passar o administrador logado', async () => {
        const mw = verifyUserRole('ADMIN')
        const req: any = { headers: {}, user: { sub: 'u1', role: 'ADMIN' } }
        const reply = fakeReply()
        const r = await mw(req, reply)
        expect(reply.code).toBe(0)
        expect(r).toBeUndefined()
    })
})
