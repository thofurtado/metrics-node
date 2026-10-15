import type { Prisma } from '@prisma/client'

/**
 * Fase 4 do Mergulho (13:D11): a única trava contra despesa em dobro era a do comprovante. Clique duplo, a tela que
 * reenvia o mesmo pedido ou o celular que manda de novo criavam dois lançamentos iguais (uma das causas das 44 cópias
 * do Marujo, 01/10/2026). Agora o lançamento IGUAL a um criado há menos de JANELA_MS é recusado (409, código
 * LANCAMENTO_REPETIDO), a não ser que o pedido diga que é de propósito (allow_repeat: true; a web pergunta antes).
 * Igual = mesma operação, valor, conta, descrição, forma, cartão, fornecedor, setor e vencimento (no mesmo dia).
 * A conferência fica no banco: vale para todos os processos da nuvem.
 */
export const JANELA_REPETIDO_MS = 2 * 60 * 1000
export const CODIGO_REPETIDO = 'LANCAMENTO_REPETIDO'
export const MENSAGEM_REPETIDO = 'Já existe um lançamento igual (mesmo valor, conta, descrição e vencimento) criado há menos de 2 minutos. Ele não foi lançado de novo.'

export interface DadosDoLancamento {
    operation: string
    amount: number
    account_id: string
    description?: string | null
    payment_method?: string | null
    credit_card_id?: string | null
    supplier_id?: string | null
    sector_id?: string | null
    data_vencimento?: Date | null
}

const DIA_MS = 24 * 60 * 60 * 1000

export function ondeProcurarRepetido(dados: DadosDoLancamento, agora: Date = new Date()): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
        created_at: { gte: new Date(agora.getTime() - JANELA_REPETIDO_MS) },
        operation: dados.operation,
        amount: dados.amount,
        account_id: dados.account_id || null,
        // Mesmos padrões com que o lançamento é gravado (use-cases/transaction.ts): descrição vazia e forma BOLETO
        description: dados.description || '',
        payment_method: dados.payment_method || 'BOLETO',
        credit_card_id: dados.credit_card_id || null,
        supplier_id: dados.supplier_id || null,
        sector_id: dados.sector_id || null,
    }
    if (dados.data_vencimento) {
        // "Mesmo dia" com folga de meio dia para cada lado (a tela pode mandar a data com hora ou à meia-noite UTC)
        const t = dados.data_vencimento.getTime()
        where.data_vencimento = { gt: new Date(t - DIA_MS / 2), lt: new Date(t + DIA_MS / 2) }
    }
    return where
}
