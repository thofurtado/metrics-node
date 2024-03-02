import {FastifyRequest, FastifyReply} from 'fastify'
import {z} from 'zod'
import { InvalidCredentialsError } from '@/use-cases/errors/invalid-credentials-error'
import { makeAuthenticateuseCase } from '@/use-cases/factories/make-authenticate-use-case'



export async function authenticate (request: FastifyRequest, reply: FastifyReply) {


    const authenticateBodySchema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
    })


    const { email, password} = authenticateBodySchema.parse(request.body)

    try {

        const authenticateUseCase = makeAuthenticateuseCase()
        await authenticateUseCase.execute({
            email,
            password
        })
    } catch(err){
        if(err instanceof InvalidCredentialsError){
            return reply.status(400).send({message: err.message})
        }
        throw err
    }
}


