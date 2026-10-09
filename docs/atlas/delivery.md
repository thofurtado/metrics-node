# Delivery e pedidos online

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/delivery.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Pedidos que nascem na nuvem (cardápio online, iFood, 99Food) ou no delivery do PDV, o vínculo dos itens das plataformas com os produtos do Metrics e o diário de eventos do iFood. Pela decisão R2/R3, com PDV o delivery sobe como venda do caixa que deu a baixa.

## Trabalhos que rodam o tempo todo

### Vigia de pedidos online do PDV (reserva do canal ao vivo) — Defeito
- **Frequência:** a cada 5 s, 2 chamadas (24 por minuto)
- **Onde roda:** PDV aberto no computador servidor da loja → `Nuvem: GET /api/pdv/orders/pending duas vezes (uma com includeCancelled=1)`
- **Quantos:** 1 por PDV servidor aberto, em toda loja, tenha delivery ou não. Cada "Bloquear sessão" liga mais um sem desligar o anterior (+24 por minuto até fechar o PDV) e duplica os avisos de pedido novo.
- **A cada vez:** Na nuvem: 1 consulta ao banco master e 5 ao banco da loja (pedidos com itens, clientes, endereços, produtos, perfil), sem índice na tabela de pedidos. Devolve TODOS os pedidos do dia, não só os novos: a resposta cresce ao longo do dia. Não espera a resposta anterior: com o servidor lento, as chamadas se acumulam. É cerca de 70% de tudo o que uma loja pede à nuvem.
- **Por que existe:** Reserva do canal ao vivo: se o aviso instantâneo de pedido novo falhar, o pedido ainda aparece. Também descobre pedidos que o iFood cancelou sozinho e reenvia status e deliverys feitos no PDV.
- **Se espaçar:** Com o canal ao vivo funcionando, nada muda: pedido novo e mudança de status chegam na hora. Se o canal cair, o pedido aparece até 60 s depois (hoje 5 s). A regra de 30 s do iFood vale para a nuvem, não para o PDV.
- **Proposta:** Voltar a 60 s (o próprio comentário do código diz 60), uma chamada só, desligar ao fechar a janela, não sobrepor chamadas; depois, a nuvem devolver só o que mudou.
- **Desde:** 05/09/2026: o commit b555038 trocou 60 s por 5 s junto com "correções da entrada de pedidos online" (o motivo não foi escrito)
- **Onde no código:** `Metrics.PDV/Metrics.PDV/MainWindow.xaml.cs:291`, `Metrics.PDV/Metrics.Shared/Services/OnlineOrderWatcherService.cs:307`, `Metrics.PDV/Metrics.Shared/Services/OnlineOrderWatcherService.cs:671`, `metrics-node/src/modules/public/http/controllers/get-pending-online-orders.ts:28`

### Barra de entregas do caixa na web — Excessivo
- **Frequência:** a cada 3 s (20 por minuto) com a aba visível, mesmo sem foco
- **Onde roda:** Navegador, tela do caixa (/cashier/session/:id) → `Nuvem: GET /public/orders/pending?date=… e o canal ao vivo /public/orders/stream`
- **Quantos:** 1 por aba de caixa aberta, inclusive caixa FECHADO ou CONFERIDO, datas passadas e loja sem delivery
- **A cada vez:** As mesmas 5 consultas do vigia do PDV, o dia inteiro de pedidos, sem paginação. Cada aviso do canal ao vivo refaz a consulta (também com a aba escondida); a cada reconexão chegam N avisos seguidos.
- **Por que existe:** Contadores Novos / Em produção / Conferência / Na rua e o alarme de pedido novo no caixa da web.
- **Se espaçar:** Com o canal ao vivo, o alarme continua na hora; se o canal cair, até 30-60 s.
- **Proposta:** Só com caixa ABERTO e do dia; 30-60 s com o canal ao vivo ligado e 10-15 s se ele cair; juntar avisos em rajada.
- **Onde no código:** `metrics/src/pages/app/cashier/components/DeliveryOrdersBar.tsx:72`, `metrics/src/pages/app/cashier/components/DeliveryOrdersBar.tsx:159`, `metrics/src/pages/app/cashier/components/DetalheLote.tsx:499`

### Atualização da tela Delivery do PDV — Excessivo
- **Frequência:** a cada 4 s (15 por minuto) enquanto a tela está visível
- **Onde roda:** PDV com a tela Delivery aberta (servidor E terminal) → `Nuvem: GET /api/pdv/orders/pending?includeCancelled=1 (mais os reenvios abaixo)`
- **Quantos:** 1 por tela Delivery aberta, também no terminal
- **A cada vez:** O mesmo custo do vigia (5 consultas, o dia inteiro de pedidos). No terminal contraria a regra "só o servidor busca na nuvem e grava" (MainWindow.xaml.cs:161) e grava pedidos no banco do servidor ao mesmo tempo que ele.
- **Por que existe:** Manter os cartões das 5 etapas (aguardando, produção, conferência, na rua, entregue) sempre atualizados.
- **Se espaçar:** Lendo só o banco local (que o servidor já mantém igual à nuvem), a tela continua a cada 4 s sem custo nenhum na nuvem.
- **Proposta:** Ler só o banco local; o terminal nunca chama a nuvem.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Views/DeliveryView.xaml.cs:97`

### Reenvio de status e de delivery feito no PDV — Atenção
- **Frequência:** a cada volta do vigia (5 s) e da tela Delivery (4 s), sem esperar mais a cada falha
- **Onde roda:** PDV aberto no computador servidor da loja → `Nuvem: PATCH /api/pdv/orders/{id}/status e POST /api/pdv/orders`
- **Quantos:** 1 por pedido com status à frente do da nuvem ou ainda não enviado (sem limite de data)
- **A cada vez:** Pedido recusado pela nuvem é reenviado inteiro a cada 4 a 5 s para sempre (o próprio comentário do código admite).
- **Por que existe:** Garantir que a nuvem (e o iFood, por ela) saiba do status que o PDV mudou e dos deliverys criados no PDV.
- **Se espaçar:** Esperar mais a cada falha não atrasa o caso normal (a primeira tentativa é na hora).
- **Proposta:** Esperar mais a cada falha (como as vendas já fazem) e só pedidos do dia.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/OnlineOrderWatcherService.cs:845`, `Metrics.PDV/Metrics.Shared/Services/OnlineOrderWatcherService.cs:930`

### Consulta de eventos do iFood (polling) — Atenção
- **Frequência:** a cada 30 s
- **Onde roda:** Nuvem (metrics-node), dentro do processo da API → `iFood (events:polling) e o banco de cada loja`
- **Quantos:** Percorre todas as lojas ativas (~14), uma de cada vez
- **A cada vez:** Loja sem token do iFood: 1 consulta ao perfil a cada volta (o "sem token" nunca fica guardado). Loja com token: 1 chamada ao iFood e 1 linha no diário (ifood_api_logs), mesmo vazia: ~2.880 linhas por dia por loja, e nada apaga esse diário. Com evento: confirma, grava e avisa. Liga em qualquer computador que rode a API, inclusive em teste local (consumiria eventos reais).
- **Por que existe:** Exigência da homologação do iFood: consultar a cada 30 s e confirmar (ACK) os eventos na hora. Sem isso o pedido não chega e o iFood pode descredenciar.
- **Se espaçar:** NÃO pode espaçar para loja com iFood.
- **Proposta:** Pular lojas sem token; limpeza do diário (ex.: 30 dias), mantendo os eventos de cancelamento da homologação; não ligar fora do servidor de produção.
- **Onde no código:** `metrics-node/src/modules/delivery/services/ifood-poller.ts:536`, `metrics-node/src/modules/delivery/services/ifood-poller.ts:61`, `metrics-node/src/modules/delivery/services/ifood-api.service.ts:109`

### Avisos ao vivo de pedido (nuvem → PDVs e caixas da web) — Atenção
- **Frequência:** a cada evento (pedido novo, status, cancelamento, exclusão)
- **Onde roda:** Nuvem (metrics-node) → `Conexões ao vivo abertas (PDVs e abas de caixa)`
- **Quantos:** Só a loja do pedido (desde a nuvem 2.6.106.2, ainda não publicada)
- **A cada vez:** Cada conexão do canal ao vivo fica guardada pelo banco da loja, e o aviso vai só para esse banco, por nome exato. Até a 2.6.106.1 os avisos do iFood e da 99 saíam sem a loja e iam para TODAS as lojas conectadas, com nome, telefone, CPF e endereço do cliente, e também para a loja de teste (db_restaurante).
- **Por que existe:** Avisar na hora o PDV e o caixa da web da loja do pedido.
- **Se espaçar:** Não é de tempo: é de destino.
- **Proposta:** Publicar a nuvem 2.6.106.2 (corrigido em 08/10/2026, commit 02134ee).
- **Desde:** Corrigido em 08/10/2026 (2.6.106.2, local)
- **Onde no código:** `metrics-node/src/lib/sse-manager.ts`, `metrics-node/src/lib/sse-manager.spec.ts`, `metrics-node/src/modules/public/http/controllers/orders-stream.ts`

### Descobrir de qual loja é um evento do iFood ou da 99 — Atenção
- **Frequência:** a cada evento; memória de 10 min
- **Onde roda:** Nuvem (metrics-node)
- **Quantos:** Por evento
- **A cada vez:** Se não está na memória, percorre todas as lojas (1 consulta em cada). Loja não cadastrada nunca fica guardada: cada evento dela varre ~14 bancos.
- **Por que existe:** O iFood e a 99 mandam o código do restaurante, não o banco: é preciso achar a loja.
- **Proposta:** Guardar também o "não achei" por alguns minutos.
- **Onde no código:** `metrics-node/src/modules/delivery/services/delivery-tenant-resolver.ts:52`

### Página de diagnóstico do iFood — Ok
- **Frequência:** a cada 3 s enquanto aberta
- **Onde roda:** Navegador com /delivery/ifood/diag aberto (equipe) → `Nuvem: /delivery/ifood/diag/data (até 400 linhas do diário)`
- **Quantos:** Só quando alguém da equipe deixa a página aberta
- **Por que existe:** Acompanhar o diário do iFood ao vivo durante testes e homologação.
- **Se espaçar:** Fechar a página quando não estiver usando.
- **Onde no código:** `metrics-node/src/modules/delivery/http/controllers/ifood-diagnostic.ts:298`

### Canal ao vivo de pedidos no PDV (SSE) — Ok
- **Frequência:** conexão sempre aberta; se cair, tenta de novo a cada 5 s
- **Onde roda:** PDV aberto no computador servidor da loja → `Nuvem: /api/pdv/orders/stream`
- **Quantos:** 1 por PDV servidor (protegido contra duplicar)
- **A cada vez:** Ao conectar, a nuvem consulta os pendentes e manda um aviso por pedido. Depois só avisa pedido novo, mudança de status e exclusão.
- **Por que existe:** É o "tempo real" do delivery: o pedido do cardápio, do iFood e da 99 aparece no PDV na hora, sem perguntar sem parar.
- **Se espaçar:** Não se aplica: é uma conexão parada. É ela que permite espaçar o vigia de 5 s.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/OnlineOrderWatcherService.cs:146`, `metrics-node/src/modules/public/http/controllers/orders-stream.ts:34`

## Tabelas e Estrutura de Dados

### Pedido online (`pedidos`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Pedido do cardápio online, iFood, 99Food ou delivery feito no PDV, com cliente, endereço, status da entrega e NFC-e. Quando vira venda, tem o mesmo código da venda.
- **Quem grava:** O cardápio online, o recebimento do iFood (consulta a cada 30 s e webhook), o webhook do 99Food e o PDV (delivery lançado no balcão).
- **Quem lê:** PDV (pedidos pendentes e mudanças de status) e Conferência de caixa (barra de deliveries do dia).
- **Cresce:** Um por pedido.

### Item do pedido (`pedido_itens`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Itens do pedido online, com o código e o nome que o item tem no iFood/99Food.

### Vínculo com delivery (`delivery_item_mappings`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga o código do item no iFood/99Food a um produto do Metrics. Um vínculo vale para sempre e corrige os pedidos antigos daquele código.
- **Quem grava:** Tela Mercadorias → Vínculos com Delivery.

### Diário do iFood (`ifood_api_logs`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada chamada e cada evento do iFood (e ações do PDV no cancelamento), com tempo e resultado. É a evidência usada na homologação.
- **Quem lê:** Página de diagnóstico /delivery/ifood/diag.
- **Cresce:** Várias linhas por pedido do iFood.

### Taxa de entrega (PDV) (`taxas_entrega`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Taxa por setor de bairros, cadastrada no PDV.

### Entregador (PDV) (`motoboys`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cadastro dos entregadores usados no acerto do motoboy.

## Pendências e decisões

- Decisão R2/R3: o delivery com PDV vira venda do caixa que deu a baixa, e a Conferência não pode contá-lo duas vezes.
- 08/10/2026: as tabelas pedidos e pedido_itens não têm índice além da chave (faltam uuid, data_abertura e pedido_id); toda sondagem de pedidos e o acompanhamento do cardápio leem a tabela inteira.
- 08/10/2026 (LGPD): avisos ao vivo do iFood e da 99 vão para todas as lojas conectadas (ver o trabalho "Avisos ao vivo de pedido").
