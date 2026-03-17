import http from 'http'

const req = http.request({
  method: 'POST',
  host: '127.0.0.1',
  port: 3333,
  path: '/sessions',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('Status Code:', res.statusCode);
  res.on('data', d => process.stdout.write(d))
})

req.on('error', error => console.error(error))
req.write(JSON.stringify({ email: "invalid", password: "123" }))
req.end()
