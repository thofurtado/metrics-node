import {FastifyRequest, FastifyReply} from 'fastify'
import {z} from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { makeRegisteruseCase } from '@/use-cases/factories/make-register-use-case'




export async function register (request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        introduction: z.string().nullish(),
        role: z.string().nullish()
    })

    const {name, email, password, introduction, role} = registerBodySchema.parse(request.body)

    try {
        const registerUseCase = makeRegisteruseCase()
        await registerUseCase.execute({
            name,
            email,
            password,
            introduction: introduction ? introduction : null,
            role: role ? role : undefined
        })
    } catch(err){
        if(err instanceof UserAlreadyExistsError){
            return reply.status(409).send({message: err.message})
        }
        throw err
    }
    return reply.status(200).send()
}


