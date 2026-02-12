export class ThisNameAlreadyExistsError extends Error {
    constructor(){
        super('Nome já cadastrado')
    }
}
