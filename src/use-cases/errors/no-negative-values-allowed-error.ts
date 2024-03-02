export class NoNegativeValuesAllowedError extends Error {
    constructor(){
        super('Não é permitido valores negativos para esta variavel')
    }
}
