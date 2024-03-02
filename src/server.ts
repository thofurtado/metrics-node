import { app } from '@/app'
import {env} from '@/env'

app.listen({
    //facilita o front-end de acessar o back
    host:'0.0.0.0',
    port: env.PORT
}).then(() => {
    console.log(' HTTP Server Running!')
})
