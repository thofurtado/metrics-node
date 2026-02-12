export class StockCannotBeNegativaError extends Error {
    constructor(){
        super('O Estoque do produto não pode ser negativo')
    }
}
