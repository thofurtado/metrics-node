// Fixa o fuso do processo em Brasília antes de qualquer outro módulo carregar. Todos os clientes
// são do Brasil: sem isso, "hoje", "0h" e todo cálculo de dia/mês (conferência de caixa,
// vencimentos, dashboard) usam o fuso do servidor de hospedagem, que pode não ser o do Brasil.
process.env.TZ = 'America/Sao_Paulo'

import { startIfoodPollingLoop } from '@/modules/delivery/services/ifood-poller'
import { app } from '@/app'
import {env} from '@/env'

app.listen({
    //facilita o front-end de acessar o back
    host:'0.0.0.0',
    port: env.PORT
}).then(() => {
    console.log('Servidor HTTP Rodando 💈!')
    startIfoodPollingLoop()
})
