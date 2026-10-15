import { AccountLinks, AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

interface DeleteAccountUseCaseRequest {
    id: string
}

/**
 * Fase 4 do Mergulho (13:D2): excluir conta não conferia nada. No banco, apagar a conta deixa os lançamentos dela
 * SEM conta (a ligação é "SET NULL": o histórico se solta e some do extrato), solta cartões, formas de pagamento e
 * maquininhas, e só dá erro 500 quando há ajuste de saldo. Agora a conta em uso não é excluída, com o motivo.
 */
export function motivoParaNaoExcluirConta(links: AccountLinks): string | null {
    const partes: string[] = []
    if (links.transactions > 0) partes.push(`${links.transactions} lançamento(s)`)
    if (links.creditCards > 0) partes.push(`${links.creditCards} cartão(ões) de crédito`)
    if (links.paymentMethods > 0) partes.push(`${links.paymentMethods} forma(s) de pagamento`)
    if (links.posMachines > 0) partes.push(`${links.posMachines} maquininha(s)`)
    if (partes.length === 0) return null
    return `Esta conta não pode ser excluída porque está ligada a ${partes.join(', ')}. Mude esses registros para outra conta antes de excluir.`
}

export class DeleteAccountUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({ id }: DeleteAccountUseCaseRequest): Promise<void> {
        const account = await this.accountsRepository.findById(id)

        if (!account) {
            throw new ResourceNotFoundError()
        }

        const motivo = motivoParaNaoExcluirConta(await this.accountsRepository.countLinks(id))
        if (motivo) {
            throw new ResourceDependencyError(motivo)
        }

        await this.accountsRepository.delete(id)
    }
}
