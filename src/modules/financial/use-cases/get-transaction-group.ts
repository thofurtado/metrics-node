import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface GetTransactionGroupRequest {
    groupId: string
}

export class GetTransactionGroupUseCase {
    async execute({ groupId }: GetTransactionGroupRequest) {
        // Use 'any' cast if properties are missing in type definition but exist in schema
        const group = await (prisma as any).transactionGroup.findUnique({
            where: { id: groupId },
            include: {
                transactions: {
                    orderBy: { data_vencimento: 'asc' }
                }
            }
        })

        if (!group) {
            throw new ResourceNotFoundError()
        }

        return { group }
    }
}
