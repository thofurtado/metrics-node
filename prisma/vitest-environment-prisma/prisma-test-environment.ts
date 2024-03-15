import { env } from '@/env'
import { Environment } from 'vitest'

export default <Environment>{
    name: 'prisma',
    transformMode: 'ssr',

    // optional - only if you support "experimental-vm" pool
    async setupVM() {
        const vm = await import('node:vm')
        const context = vm.createContext({
            options: {
                env: '.env',
                prismaEnvVarName: env.DATABASE_URL
            }
        })
        return {
            getVmContext() {
                return context
            },
            teardown() {
                // called after all tests with this env have been run
            }
        }
    },
    setup() {
        // custom setup
        console.log('setup')
        return {
            teardown() {
                // called after all tests with this env have been run
                console.log('teardown')
            }
        }
    }
}
