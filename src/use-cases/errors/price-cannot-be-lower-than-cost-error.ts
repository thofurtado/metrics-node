export class PriceCannotBeLowerThanCost extends Error {
    constructor(){
        super('Custo não pode ser menor que valor de venda')
    }
}
