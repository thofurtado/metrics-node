import 'dotenv/config'
import {z} from 'zod'

// Safeguard (Trava de Segurança Antidestruição)
if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    const dbUrl = process.env.DATABASE_URL || '';
    const isProductionDb = dbUrl.includes('187.77.232.244') || 
                           dbUrl.includes('db_marujo') || 
                           dbUrl.includes('marujogastrobar') ||
                           dbUrl.includes('aws.neon.tech') ||
                           (dbUrl.includes('postgres') && 
                            !dbUrl.includes('localhost') && 
                            !dbUrl.includes('127.0.0.1') && 
                            !dbUrl.includes('docker') &&
                            !dbUrl.includes('apisolid')); // test db name

    if (isProductionDb) {
        console.error('\n🚨 ====================================================================');
        console.error('🚨 ERRO CRÍTICO DE SEGURANÇA: Tentativa de rodar testes contra banco de dados de produção!');
        console.error('🚨 DATABASE_URL detectada:', dbUrl);
        console.error('🚨 A execução foi ABORTADA imediatamente para proteger os dados de produção.');
        console.error('🚨 ====================================================================\n');
        throw new Error('BLOQUEIO DE SEGURANÇA: Testes impedidos de rodar contra o banco de produção.');
    }
}

// process.env: {NODE_ENV:  'dev', ...}
// npm i zod
// npm i dotenv



const envSchema = z.object({
    // Quais são as opções de ambiente para o node rodar
    NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
    // chave secreta
    JWT_SECRET: z.string(),
    // coerce força a conversão, fazendo com que mesmo que seja string, entre como numero a porta
    PORT: z.coerce.number().default(3333),
    // Chave de integração para sistemas externos (conferência de caixa, etc.)
    INTEGRATION_API_KEY: z.string().default('marujo-metrics-integration-2026'),
})

const _env = envSchema.safeParse(process.env)

// na versão antiga o safeParse retornava um booleano, agora retorna a variavel success com a informação de verdadeiro ou falso
if(_env.success == false) {
    console.error(' Invalid environment variables', _env.error.format())
    throw new Error('Invalid environment variables')

}

export const env = _env.data
