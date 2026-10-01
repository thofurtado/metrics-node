import path from 'path'
import fs from 'fs/promises'
import type { StorageAdapter } from '@/lib/storage'

/**
 * Comprovante avulso (lista "Comprovantes" do Financeiro) virando anexo de uma despesa.
 *
 * Regra do Thomás (01/10/2026): o comprovante tem que sair da lista NO MOMENTO em que é vinculado ou vira despesa. Antes a nuvem
 * copiava o arquivo e só no fim tentava apagá-lo, engolindo o erro; e a tela criava a despesa num envio e vinculava em outro.
 * Se a 2ª parte falhava, o comprovante continuava na lista e podia virar outra despesa (caso Marujo, 40+ despesas em dobro).
 *
 * Agora o comprovante é RESERVADO antes de tudo: o arquivo é movido (operação única do sistema de arquivos) para a subpasta
 * `_vinculando`, que a lista não mostra. Dois envios com o mesmo comprovante (duas telas, clique duplo): só um consegue mover; o outro recebe
 * "já foi usado". Se algo falhar depois, o arquivo volta para a lista (não se perde a foto).
 */

export const PASTA_EM_USO = '_vinculando'

/** Comprovantes sendo movidos agora por este processo (caminho completo). */
const emReserva = new Set<string>()

export class ComprovanteJaUsadoError extends Error {
    constructor() {
        super('Este comprovante não está mais na lista: já foi usado em outra despesa ou foi descartado. Atualize a lista de comprovantes.')
        this.name = 'ComprovanteJaUsadoError'
    }
}

export class NomeDeComprovanteInvalidoError extends Error {
    constructor() {
        super('Nome de comprovante inválido.')
        this.name = 'NomeDeComprovanteInvalidoError'
    }
}

/** Só aceita o nome do arquivo, sem pasta (impede "../" para sair da pasta de comprovantes). */
export function validarNomeDoComprovante(filename: string) {
    if (!filename || filename !== path.basename(filename) || filename.startsWith('.') || filename.includes('\\') || filename === PASTA_EM_USO) {
        throw new NomeDeComprovanteInvalidoError()
    }
}

export class ComprovanteReservado {
    private concluido = false

    private constructor(
        private readonly origem: string,
        private readonly emUso: string,
        readonly filename: string,
    ) { }

    /**
     * Tira o comprovante da lista (move para `_vinculando`). Falha com ComprovanteJaUsadoError se ele não estiver mais lá.
     * Dois envios ao mesmo tempo: a trava `emReserva` deixa só um mover (no Windows, mover o mesmo arquivo ao mesmo tempo
     * "dá certo" para todos, testado em 01/10/2026; no Linux do servidor a 2ª tentativa já falha sozinha).
     */
    static async reservar(pastaComprovantes: string, filename: string): Promise<ComprovanteReservado> {
        validarNomeDoComprovante(filename)
        const origem = path.join(pastaComprovantes, filename)
        if (emReserva.has(origem)) throw new ComprovanteJaUsadoError()
        emReserva.add(origem)
        try {
            const pastaEmUso = path.join(pastaComprovantes, PASTA_EM_USO)
            await fs.mkdir(pastaEmUso, { recursive: true })
            const emUso = path.join(pastaEmUso, `${Date.now()}_${filename}`)
            try {
                await fs.rename(origem, emUso)
            } catch (err: any) {
                if (err?.code === 'ENOENT') throw new ComprovanteJaUsadoError()
                throw err
            }
            return new ComprovanteReservado(origem, emUso, filename)
        } finally {
            emReserva.delete(origem)
        }
    }

    /**
     * Anexa o comprovante à despesa (copia para a pasta de anexos e grava o endereço na despesa). Só depois de gravado no banco
     * o anexo antigo da despesa (se havia) é apagado. Falhou: o comprovante volta para a lista.
     */
    async anexarA(
        transactionId: string,
        deps: {
            storage: StorageAdapter
            buscarAnexoAtual: (id: string) => Promise<string | null | undefined>
            gravarAnexo: (id: string, url: string) => Promise<void>
        },
    ): Promise<string> {
        let novoAnexo: string | null = null
        try {
            const anexoAntigo = await deps.buscarAnexoAtual(transactionId)
            const conteudo = await fs.readFile(this.emUso)
            const ext = this.filename.includes('.') ? this.filename.substring(this.filename.lastIndexOf('.')) : ''
            novoAnexo = await deps.storage.save(conteudo, 'transactions', ext)
            await deps.gravarAnexo(transactionId, novoAnexo)
            if (anexoAntigo && anexoAntigo !== novoAnexo) {
                await deps.storage.delete(anexoAntigo).catch((e) => console.error('[comprovante] anexo antigo não apagado:', e))
            }
        } catch (err) {
            if (novoAnexo) await deps.storage.delete(novoAnexo).catch(() => { /* a cópia que sobrou não aparece em lugar nenhum */ })
            await this.devolver()
            throw err
        }
        await this.concluir()
        return novoAnexo
    }

    /** Volta o comprovante para a lista (quando a despesa não pôde ser criada ou o anexo falhou). */
    async devolver() {
        if (this.concluido) return
        this.concluido = true
        try {
            await fs.rename(this.emUso, this.origem)
        } catch (err) {
            console.error('[comprovante] não voltou para a lista (fica em _vinculando):', this.filename, err)
        }
    }

    /** Já anexado: apaga a reserva. Se não der para apagar, ela continua fora da lista (em _vinculando). */
    private async concluir() {
        this.concluido = true
        await fs.unlink(this.emUso).catch((err) => console.error('[comprovante] reserva não apagada (fora da lista):', this.filename, err))
    }
}
