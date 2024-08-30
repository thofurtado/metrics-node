import { prisma } from '@/lib/prisma'
import { $Enums, Prisma } from '@prisma/client'
import { UsersRepository } from '../users-repository'


export class PrismaUsersRepository implements UsersRepository {
    async update(id:string, data: Prisma.UserUpdateInput): Promise<{ id: string; name: string; role: $Enums.Role; email: string; password_hash: string; introduction: string | null }> {
        const user = await prisma.user.update({
            where: { id },
            data: {
                name: data.name,
                introduction: data.introduction,
                password_hash: data.password_hash
            }
        })
        return user
    }
    async findById(id: string) {
        const user = await prisma.user.findUnique({
            where: {
                id
            }
        })
        return user
    }
    async findByEmail(email: string) {
        const user = await prisma.user.findUnique({
            where: {
                email
            }
        })
        return user
    }
    async create(data: Prisma.UserCreateInput) {

        const user = await prisma.user.create({
            data
        })
        return user
    }
}
