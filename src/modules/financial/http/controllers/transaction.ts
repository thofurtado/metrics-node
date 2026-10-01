
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeTransactionUseCase } from '@/modules/financial/use-cases/factories/make-transaction-use-case'
import { ComprovanteReservado, ComprovanteJaUsadoError, NomeDeComprovanteInvalidoError } from '@/modules/uploads/comprovante-pendente'
import { pastaDeComprovantes, anexoDaDespesa } from '@/modules/uploads/http/controllers/upload'




export async function createTransaction(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        operation: z.string(),
        amount: z.number(),
        account_id: z.string(),
        data_vencimento: z.coerce.date().nullish(),
        data_emissao: z.coerce.date().nullish(),
        sector_id: z.string().nullish(),
        description: z.string().nullish(),
        confirmed: z.boolean().nullish(),
        destination_account_id: z.string().nullish(),
        destination_account: z.string().nullish(),
        supplier_id: z.string().nullish(),
        payment_method: z.string().nullish(),
        installments_count: z.number().nullish(),
        interval_frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).nullish(),
        custom_installments: z.array(z.object({
            data_vencimento: z.coerce.date(),
            data_emissao: z.coerce.date().optional(),
            amount: z.number()
        })).nullish(),
        interest: z.number().nullish(),
        fine: z.number().nullish(),
        discount: z.number().nullish(),
        totalValue: z.number().nullish(),
        credit_card_id: z.string().uuid().nullish(),
        // Comprovante da lista "Comprovantes" que vira esta despesa (01/10/2026): reservado antes de criar, anexado no mesmo envio
        receipt_filename: z.string().nullish(),
    })

    // console.log('Payload Recebido:', JSON.stringify(request.body, null, 2))

    const {
        operation,
        amount,
        account_id,
        data_vencimento,
        data_emissao,
        sector_id,
        description,
        confirmed,
        destination_account_id,
        destination_account,
        supplier_id,
        payment_method,
        installments_count,
        interval_frequency,
        custom_installments,
        interest,
        fine,
        discount,
        totalValue,
        credit_card_id,
        receipt_filename,
    } = registerBodySchema.parse(request.body)

    const effectiveDestinationAccountId = destination_account_id || (destination_account as string) || null

    if (operation === 'transfer') {
        if (!effectiveDestinationAccountId) {
            return reply.status(400).send({ message: 'Conta de destino é obrigatória para transferências.' })
        }
        if (effectiveDestinationAccountId === account_id) {
            return reply.status(400).send({ message: 'A conta de destino deve ser diferente da conta de origem.' })
        }
    }

    // O comprovante sai da lista ANTES de a despesa existir. Já usado (outra tela, clique duplo): a despesa nem é criada.
    let reserva: ComprovanteReservado | null = null
    if (receipt_filename) {
        try {
            reserva = await ComprovanteReservado.reservar(pastaDeComprovantes(), receipt_filename)
        } catch (err) {
            if (err instanceof ComprovanteJaUsadoError) return reply.status(409).send({ message: err.message })
            if (err instanceof NomeDeComprovanteInvalidoError) return reply.status(400).send({ message: err.message })
            throw err
        }
    }

    let transaction
    try {

        const transactionUseCase = MakeTransactionUseCase()

        transaction = await transactionUseCase.execute({
            operation,
            amount,
            account_id,
            confirmed: confirmed || null,
            data_vencimento: data_vencimento || null,
            data_emissao: data_emissao || null,
            sector_id: sector_id || null,
            description: description || null,
            destination_account_id: effectiveDestinationAccountId,
            supplier_id: supplier_id || null,
            payment_method: payment_method || null,
            installments_count: installments_count || undefined,
            interval_frequency: interval_frequency || undefined,
            custom_installments: custom_installments || undefined,
            interest: interest || null,
            fine: fine || null,
            discount: discount || null,
            totalValue: totalValue || null,
            credit_card_id: credit_card_id || null,
        })
    } catch (err) {
        await reserva?.devolver() // a despesa não foi criada: o comprovante volta para a lista

        if (err instanceof Error) {
            console.error(err)
            return reply.status(409).send({ message: err.message })
        }

        throw err

    }

    if (reserva) {
        try {
            await reserva.anexarA(transaction.transaction.id, anexoDaDespesa())
            return reply.status(200).send({ ...transaction, receipt_linked: true })
        } catch (err) {
            // Rara: despesa criada, mas o anexo falhou. O comprovante volta para a lista (a foto não se perde) e a tela avisa.
            console.error('[comprovante] despesa criada sem o anexo:', err)
            return reply.status(200).send({
                ...transaction,
                receipt_linked: false,
                receipt_error: 'A despesa foi salva, mas o comprovante não foi anexado. Ele continua na lista: use "Vincular a existente".',
            })
        }
    }
    return reply.status(200).send(transaction)
}


