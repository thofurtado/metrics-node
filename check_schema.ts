import { prisma } from './src/lib/prisma'

async function main() {
    try {
        const res = await prisma.systemConfig.findFirst()
        console.log('SUCCESS: ', JSON.stringify(res, null, 2))
    } catch (e) {
        console.error('ERROR: ', e)
    } finally {
        await prisma.$disconnect()
    }
}
main()
