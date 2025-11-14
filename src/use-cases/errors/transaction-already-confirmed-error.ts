export class TransactionAlreadyConfirmedError extends Error {
    constructor() {
        super('Transaction is already confirmed and cannot be changed.')
        this.name = 'TransactionAlreadyConfirmedError'
    }
}