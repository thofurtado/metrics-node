import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import {
    ComprovanteReservado, ComprovanteJaUsadoError, NomeDeComprovanteInvalidoError, PASTA_EM_USO,
} from '@/modules/uploads/comprovante-pendente'
import type { StorageAdapter } from '@/lib/storage'

// O comprovante sai da lista no momento em que é vinculado ou vira despesa, e um mesmo comprovante não vira duas despesas
// (caso Marujo, 01/10/2026).
let pasta: string
let anexos: Map<string, string | null>
let salvos: string[]
let apagados: string[]
let storage: StorageAdapter

const NOME = '1759330000000_meta_eyJkIjoiYWRlZ2FvIDAzIiwidiI6NTk2LjV9.jpg'

async function naLista() {
    return (await fs.readdir(pasta)).filter((f) => f !== PASTA_EM_USO)
}

function deps(falharAoGravar = false) {
    return {
        storage,
        buscarAnexoAtual: async (id: string) => anexos.get(id) ?? null,
        gravarAnexo: async (id: string, url: string) => {
            if (falharAoGravar) throw new Error('banco fora')
            anexos.set(id, url)
        },
    }
}

describe('Comprovante pendente', () => {
    beforeEach(async () => {
        pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'comprovantes-'))
        await fs.writeFile(path.join(pasta, NOME), 'foto do boleto')
        anexos = new Map([['despesa-1', null], ['despesa-2', '/uploads/t/transactions/antigo.jpg']])
        salvos = []
        apagados = []
        let n = 0
        storage = {
            save: async (_b, pastaDestino, ext) => { const u = `/uploads/t/${pastaDestino}/novo-${++n}${ext}`; salvos.push(u); return u },
            delete: async (u) => { apagados.push(u) },
        }
    })

    afterEach(async () => {
        await fs.rm(pasta, { recursive: true, force: true })
    })

    it('sai da lista assim que é reservado, antes de a despesa existir', async () => {
        await ComprovanteReservado.reservar(pasta, NOME)
        expect(await naLista()).toEqual([])
    })

    it('anexado à despesa: some de vez e a despesa fica com o anexo', async () => {
        const reserva = await ComprovanteReservado.reservar(pasta, NOME)
        const url = await reserva.anexarA('despesa-1', deps())
        expect(anexos.get('despesa-1')).toBe(url)
        expect(await naLista()).toEqual([])
        expect(await fs.readdir(path.join(pasta, PASTA_EM_USO))).toEqual([])
    })

    it('o mesmo comprovante não vira duas despesas: a 2ª reserva é recusada', async () => {
        const reserva = await ComprovanteReservado.reservar(pasta, NOME)
        await expect(ComprovanteReservado.reservar(pasta, NOME)).rejects.toBeInstanceOf(ComprovanteJaUsadoError)
        await reserva.anexarA('despesa-1', deps())
        await expect(ComprovanteReservado.reservar(pasta, NOME)).rejects.toBeInstanceOf(ComprovanteJaUsadoError)
    })

    it('dois envios ao mesmo tempo com o mesmo comprovante: só um consegue', async () => {
        const resultados = await Promise.allSettled([
            ComprovanteReservado.reservar(pasta, NOME),
            ComprovanteReservado.reservar(pasta, NOME),
            ComprovanteReservado.reservar(pasta, NOME),
        ])
        expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    })

    it('se gravar o anexo falhar, o comprovante volta para a lista (a foto não se perde)', async () => {
        const reserva = await ComprovanteReservado.reservar(pasta, NOME)
        await expect(reserva.anexarA('despesa-1', deps(true))).rejects.toThrow('banco fora')
        expect(await naLista()).toEqual([NOME])
        expect(apagados).toEqual(salvos) // a cópia feita para o anexo é descartada
    })

    it('despesa que já tinha anexo: troca e apaga o antigo só depois de gravar o novo', async () => {
        const reserva = await ComprovanteReservado.reservar(pasta, NOME)
        const url = await reserva.anexarA('despesa-2', deps())
        expect(anexos.get('despesa-2')).toBe(url)
        expect(apagados).toEqual(['/uploads/t/transactions/antigo.jpg'])
    })

    it('devolver (despesa não foi criada): volta para a lista', async () => {
        const reserva = await ComprovanteReservado.reservar(pasta, NOME)
        await reserva.devolver()
        expect(await naLista()).toEqual([NOME])
    })

    it('recusa nome com pasta (não sai da pasta de comprovantes)', async () => {
        for (const nome of ['../segredo.jpg', 'a/b.jpg', 'a\\b.jpg', '.oculto', PASTA_EM_USO, '']) {
            await expect(ComprovanteReservado.reservar(pasta, nome)).rejects.toBeInstanceOf(NomeDeComprovanteInvalidoError)
        }
    })
})
