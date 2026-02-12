export class DisplayIdAlreadyExistsError extends Error {
    constructor() {
        super('Display ID already exists.')
    }
}
