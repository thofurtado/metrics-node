import 'dotenv/config'
import {z} from 'zod'


// process.env: {NODE_ENV:  'dev', ...}
// npm i zod
// npm i dotenv


const envSchema = z.object({
    // Quais são as opções de ambiente para o node rodar
    NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
    // coerce força a conversão, fazendo com que mesmo que seja string, entre como numero a porta
    PORT: z.coerce.number().default(3333),
})

const _env = envSchema.safeParse(process.env)

// na versão antiga o safeParse retornava um booleano, agora retorna a variavel success com a informação de verdadeiro ou falso
if(_env.success == false) {
    console.error(' Invalid environment variables', _env.error.format())
    throw new Error('Invalid environment variables')

}

export const env = _env.data
