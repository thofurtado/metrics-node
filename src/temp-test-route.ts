import { app } from './app'

async function run() {
    await app.ready()
    const res = await app.inject({
        method: 'GET',
        url: '/hr/time-clocks'
    })

    console.log(res.statusCode)
    console.log(res.body)
}

run()
