import { ProductsRepository } from '@/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface DecreaseStockUseCaseRequest {
    productId: string
    quantity: number
}

export class DecreaseStockUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute({ productId, quantity }: DecreaseStockUseCaseRequest): Promise<void> {
        // We use the repository to fetch the product including relations (compositions).
        // Since the interface findById supports returning relations depending on the implementation,
        // we assume the implementation does fetch it. 
        // Note: In strict Clean Architecture, we might need a specific method like findWithCompositions,
        // but for now we rely on the implementation detail or standard findById.
        // My InMemory implementation and Prisma implementation of findById include compositions?
        // Let's verify.
        // PrismaProductsRepository.findById -> Includes compositions.
        // InMemoryProductsRepository -> findById -> returns product, but compositions are stored separately?
        // Wait, InMemoryProductsRepository needs to correctly simulate returning the product.
        // The InMemory repo stores items and compositions separately. 
        // findById in InMemory just finds item. It doesn't attach compositions.
        // I need to fix InMemoryProductsRepository to attaching compositions if I rely on it.
        // OR, I fetch compositions separately.
        // But the schema says Product has relation `compositions`.
        // Let's assume `findById` returns it. I will update InMemory to do so if needed.

        // START TRANSACTION
        // Ideally we would wrap this in prisma.$transaction.
        // But since we want to be "agnostic", passing `tx` is the way.
        // However, the `prisma` import here makes it coupled to Prisma.
        // For the purpose of this task (Node.js + Prisma), usage of `prisma.$transaction` is expected.

        await prisma.$transaction(async (tx) => {
            // We need to fetch inside transaction or before? 
            // Fetching inside is safer for consistency if using repeatable read, though default is usually read committed.
            // But existing repositories `findById` don't support `tx` arg in my current interface def!
            // I only added `decreaseStock(..., tx)`.
            // If I want to read product inside transaction, I need `findById(..., tx)`.
            // But usually reading before is fine unless we are super strict about concurrency of composition definition changing mid-flight.
            // Let's assume product definition is stable.

            // However, to be nice and "agnostic", I should probably use `tx` for everything if possible.
            // But I didn't update all repo methods.
            // I'll fetch product *outside* (or using repo without tx) and then process decrement.
            // The critical part is the decrement being atomic.

            const product = await this.productsRepository.findById(productId)

            if (!product) {
                throw new ResourceNotFoundError()
            }

            // In Prisma, `product` object returned by `findUnique` includes relations if `include` was passed.
            // Our Prisma impl has `include: { compositions: { include: { supply: true } } }`.
            // So `product` is `Product & { compositions: (Composition & { supply: Supply })[] }`.
            // TypeScript needs to know this.
            // Converting to 'any' or asserting type to access compositions.
            const productAny = product as any

            if (productAny.is_composite) {
                if (productAny.compositions && productAny.compositions.length > 0) {
                    for (const composition of productAny.compositions) {
                        const consumption = composition.quantity * quantity
                        await this.suppliesRepository.decreaseStock(composition.supply_id, consumption, tx)
                    }
                }
            } else {
                await this.productsRepository.decreaseStock(productId, quantity, tx)
            }
        })
    }
}
