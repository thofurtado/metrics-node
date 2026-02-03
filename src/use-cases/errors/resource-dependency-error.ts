export class ResourceDependencyError extends Error {
    constructor(message?: string) {
        super(message || 'Resource cannot be deleted because it is being used by other records.')
    }
}
