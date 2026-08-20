import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TransactionAlreadyConfirmedError } from '@/modules/financial/use-cases/transaction-already-confirmed-error'
import { Prisma, Transaction } from '@prisma/client'

// Interface que define os dados de entrada
interface ChangeTransactionUseCaseRequest {
    id: string
    amount: number // Valor que está sendo pago/recebido (liquidação)
    interest?: number
    fine?: number
    discount?: number
    date: Date // Data efetiva do pagamento/recebimento
    remainingDate?: Date // Data de vencimento da parcela restante (opcional)
    account_id?: string // Conta selecionada para o pagamento (opcional)
    payment_method?: string
}

// Função auxiliar para padronizar e limpar a descrição de parcelas restantes,
// adicionando um indicador numérico para rastrear o nível de parcelamento (PR (1), PR (2), etc.)
function getCleanRemainingDescription(originalTransaction: Transaction): string {
    // Garante que description é uma string, usando '' se for null
    const originalDescription = originalTransaction.description || '';
    let baseDescription = originalDescription.trim();
    let currentLevel = 0;

    // 1. Regex para o NOVO padrão: PR (N): Descrição
    // Exemplo: PR (1): Aluguel
    // A flag 'i' ignora maiúsculas/minúsculas.
    const numberedPrefixRegex = /^PR\s*\((\d+)\):/i;

    // 2. Tentar encontrar o prefixo numerado
    const numberedMatch = baseDescription.match(numberedPrefixRegex);

    if (numberedMatch) {
        // Encontrou um prefixo numerado (e.g., PR (1):)
        currentLevel = parseInt(numberedMatch[1], 10);
        // Remove o prefixo numerado e mantém a descrição base
        baseDescription = baseDescription.substring(numberedMatch[0].length).trim();
    } else {
        // 3. Tentar encontrar prefixos antigos/genéricos (que implicam nível 1)
        const genericPrefixes = [
            'PR: ',
            'RES: ',
            'PARCELA RESTANTE: ',
        ];

        for (const prefix of genericPrefixes) {
            if (baseDescription.startsWith(prefix)) {
                // Encontrou um prefixo genérico. Define o nível implícito como 1.
                currentLevel = 1;
                baseDescription = baseDescription.substring(prefix.length).trim();
                break;
            }
        }
    }

    // 4. Determina o novo nível e aplica o prefixo
    // Se currentLevel era 0 (original), newLevel é 1.
    // Se currentLevel era N, newLevel é N+1.
    const newLevel = currentLevel + 1;

    // Fallback caso a descrição original fosse apenas o prefixo
    if (baseDescription === '') {
        baseDescription = 'Sem Descrição Original';
    }

    // Retorna a nova descrição com o prefixo numerado e conciso
    return `PR (${newLevel}): ${baseDescription}`;
}

export class ChangeTransactionUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }

    async execute({
        id,
        amount: amountPaid,
        interest = 0,
        fine = 0,
        discount = 0,
        date,
        remainingDate,
        account_id, // Recebe a conta
        payment_method,

    }: ChangeTransactionUseCaseRequest): Promise<void> {

        // 1. Buscar a transação original
        const originalTransaction = await this.transactionsRepository.findById(id)

        if (!originalTransaction) {
            throw new ResourceNotFoundError()
        }

        // 2. Validação: Impedir Re-liquidação
        if (originalTransaction.confirmed) {
            throw new TransactionAlreadyConfirmedError()
        }

        // 3. Validações de Valores
        if (amountPaid <= 0) {
            throw new Error('O valor de liquidação (amount) deve ser positivo.')
        }

        // 4. Validação: Impedir Pagamento Excedente (considerando juros/desconto)
        const totalCalculated = Number((originalTransaction.amount + interest + fine - discount).toFixed(2))
        if (amountPaid > totalCalculated + 0.01) {
            throw new Error(`O valor pago (${amountPaid}) não pode ser maior que o valor da transação original (${totalCalculated}).`)
        }

        // 5. Lógica de Pagamento Parcial
        // O valor remanescente é o que faltava do original menos o que foi amortizado do principal.
        // Se eu tinha 100, paguei 110 (sendo 10 juros), amortizei 100. Resta 0.
        // Se eu tinha 100, paguei 60 (sendo 10 juros), amortizei 50. Resta 50.
        const amortizedAmount = amountPaid - interest - fine + discount
        const remainingAmount = Number((originalTransaction.amount - amortizedAmount).toFixed(2));

        // Se houver saldo restante, cria uma nova transação
        if (remainingAmount > 0.01) {
            // Determina a data de vencimento da parcela restante
            const newDueDate = remainingDate || originalTransaction.data_vencimento;

            // Usa a função de limpeza e numeração para gerar uma descrição concisa
            const newDescription = getCleanRemainingDescription(originalTransaction);

            // Prepara os dados da transação remanescente
            const remainingTransactionData: Prisma.TransactionUncheckedCreateInput = {
                operation: originalTransaction.operation,
                account_id: originalTransaction.account_id, // Mantém na conta original
                sector_id: originalTransaction.sector_id,

                amount: remainingAmount,
                confirmed: false,
                data_vencimento: newDueDate,
                data_emissao: originalTransaction.data_emissao,
                description: newDescription, // <-- DESCRIÇÃO NUMERADA
                parent_transaction_id: originalTransaction.id, // Vínculo de Rastreabilidade

                // Preservar metadados cruciais
                transaction_group_id: originalTransaction.transaction_group_id,
                supplier_id: originalTransaction.supplier_id,
                credit_card_id: originalTransaction.credit_card_id,
            };

            // Cria a nova transação para o remanescente
            await this.transactionsRepository.create(remainingTransactionData);
        }

        // 6. Liquidar a transação original
        await this.transactionsRepository.changeTransactionStatus({
            id,
            amount: amortizedAmount, // the principal paid
            totalValue: amountPaid, // the exact cash flow
            interest,
            fine,
            discount,
            date,
            account_id, // Passa a nova conta para a repository atualizar antes de confirmar
            payment_method,
        })
    }
}