
export class InsufficientStockError extends Error {
    constructor(message?: string) {
        super(message || 'Estoquel insuficiente.')
    }
}
