/**
 * Juiz da nuvem na troca automática de servidor do PDV (decisões do Thomás de 30/09 e 02/10/2026).
 *
 * Cada computador da "ordem dos servidores" de uma loja avisa a cada 15 s que está vivo. A nuvem guarda, por loja, a última vez
 * que ouviu cada computador e responde há quantos segundos não ouve cada um (pelo relógio DA NUVEM: o PDV nunca compara relógios
 * de computadores diferentes) e o maior mandato conhecido. A reserva só assume se a nuvem também não ouvir o servidor (se a nuvem
 * ainda ouve, quem perdeu a conexão foi a reserva) — é o que evita dois servidores quando só o cabo entre eles quebrou.
 *
 * Fica só na memória do processo: se a nuvem reiniciar, ela informa há quanto tempo ligou, e o PDV não usa a resposta enquanto a
 * nuvem não estiver ligada há pelo menos 3 minutos (antes disso ela não pode afirmar que não ouviu alguém).
 */
export interface ComputadorVivo {
    terminalId: string
    nome: string
    situacao: string
    mandato: number
    ultimoMs: number
}

export interface RespostaJuiz {
    segundosDesdeInicio: number
    mandatoMaximo: number
    computadores: Array<{ terminalId: string; nome: string; situacao: string; mandato: number; segundosDesdeUltimo: number }>
}

/** Computador que não aparece há mais de um dia sai da lista (trocado, desinstalado). */
const ESQUECER_APOS_MS = 24 * 60 * 60 * 1000

export class JuizDaTroca {
    private readonly lojas = new Map<string, Map<string, ComputadorVivo>>()
    private readonly mandatoMaximo = new Map<string, number>()

    constructor(private readonly agora: () => number = () => Date.now(), private readonly inicioMs: number = Date.now()) {}

    avisarVivo(loja: string, c: { terminalId: string; nome?: string; situacao?: string; mandato?: number }): RespostaJuiz {
        const chaveLoja = (loja || '').trim().toLowerCase()
        const agora = this.agora()
        let computadores = this.lojas.get(chaveLoja)
        if (!computadores) {
            computadores = new Map()
            this.lojas.set(chaveLoja, computadores)
        }
        const id = c.terminalId.trim().toUpperCase()
        const mandato = Number.isFinite(c.mandato) ? Math.max(0, Math.floor(c.mandato as number)) : 0
        computadores.set(id, {
            terminalId: id,
            nome: (c.nome ?? '').slice(0, 120),
            situacao: (c.situacao ?? '').slice(0, 20),
            mandato,
            ultimoMs: agora,
        })
        // O maior mandato vale só de quem se anunciou como servidor (uma reserva não "inventa" mandato)
        if (c.situacao === 'Servidor' && mandato > (this.mandatoMaximo.get(chaveLoja) ?? 0)) {
            this.mandatoMaximo.set(chaveLoja, mandato)
        }
        for (const [chave, v] of computadores) {
            if (agora - v.ultimoMs > ESQUECER_APOS_MS) computadores.delete(chave)
        }
        return this.estado(chaveLoja)
    }

    estado(loja: string): RespostaJuiz {
        const chaveLoja = (loja || '').trim().toLowerCase()
        const agora = this.agora()
        const computadores = [...(this.lojas.get(chaveLoja)?.values() ?? [])].map((v) => ({
            terminalId: v.terminalId,
            nome: v.nome,
            situacao: v.situacao,
            mandato: v.mandato,
            segundosDesdeUltimo: Math.max(0, Math.floor((agora - v.ultimoMs) / 1000)),
        }))
        return {
            segundosDesdeInicio: Math.max(0, Math.floor((agora - this.inicioMs) / 1000)),
            mandatoMaximo: this.mandatoMaximo.get(chaveLoja) ?? 0,
            computadores,
        }
    }
}

export const juizDaTroca = new JuizDaTroca()
