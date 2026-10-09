# Trabalhos que rodam o tempo todo

> Gerado por `atlas.py` em 08/10/2026 a partir de `modulos/*.json` (campo `trabalhos`) e de `trabalhos-servidor.json`. Não edite este arquivo.

Tudo o que roda sozinho e sem parar: checagens de saúde do servidor, sondagens (perguntar de tantos em tantos segundos), conexões ao vivo, sincronias e tarefas agendadas. Cada ficha diz onde roda, o que chama, de quanto em quanto tempo, quantas cópias rodam juntas, o que custa, por que existe e o que acontece se espaçar. Numa crise de CPU da nuvem, olhe nesta ordem: (1) o servidor, que gasta CPU sem ninguém ver; (2) o que chama a nuvem com intervalo curto e se multiplica por loja e por aba; (3) o que fica só na rede da loja não pesa no servidor da nuvem. Levantamento de 08/10/2026; toda mudança nesses trabalhos atualiza esta lista na mesma tarefa.

## Todos, do mais grave ao mais leve

| Situação | Trabalho | Onde roda → o que chama | Frequência | Quantos | Proposta |
|---|---|---|---|---|---|
| Defeito | **Acompanhamento do pedido no cardápio (cliente)** (Cardápio e produtos) | Celular ou computador do cliente, passo "Seu pedido" → `Nuvem: GET /public/orders/:id/status` | a cada 2,5 s (24 por minuto), sem parar nunca | 1 por cliente com a tela aberta; no pico, dezenas por loja | Parar nos status finais e em 404; limite de ~3 h; 10-15 s; pausar com a tela escondida; mostrar "Cancelado". |
| Defeito | **TrayMonitor: painel aberto consulta a SEFAZ** (Fiscal (NFC-e)) | Computador da loja com o painel do TrayMonitor aberto → `Core Service local; /api/fiscal/status consulta a SEFAZ a cada chamada` | a cada 3 s, 4 rotas do Core Service | 1 por painel aberto | Guardar a resposta da SEFAZ por 3 min (como o PDV) e o painel a cada 10-15 s. |
| Defeito | **Acompanhamento do pedido no cardápio do Marujo** (Cardápio e produtos) | Celular ou computador do cliente do Marujo → `Nuvem: GET /public/orders/:id/status` | a cada 4 s (15 por minuto), sem parar nunca | 1 por cliente do Marujo com a tela aberta | A mesma correção do genérico e a consulta depender da janela aberta. |
| Defeito | **Vigia de pedidos online do PDV (reserva do canal ao vivo)** (Delivery e pedidos online) | PDV aberto no computador servidor da loja → `Nuvem: GET /api/pdv/orders/pending duas vezes (uma com includeCancelled=1)` | a cada 5 s, 2 chamadas (24 por minuto) | 1 por PDV servidor aberto, em toda loja, tenha delivery ou não. Cada "Bloquear sessão" liga mais um sem desligar o anterior (+24 por minuto até fechar o PDV) e duplica os avisos de pedido novo. | Voltar a 60 s (o próprio comentário do código diz 60), uma chamada só, desligar ao fechar a janela, não sobrepor chamadas; depois, a nuvem devolver só o que mudou. |
| Defeito | **Mesas ao vivo na web (aba Mesas do caixa)** (Mesas e salão) | Navegador, /cashier aba Mesas → `Nuvem: GET /pdv/sync/tables/snapshot` | a cada 10 s com a aba visível | 1 por aba aberta | Consertar a autorização, passar a 30 s (ou receber pelo canal ao vivo) e tirar as mesas de exemplo. |
| Defeito | **Windy: conexão ao vivo (comandos remotos)** (Ordens de serviço) | Computador da loja com o Windy → `Nuvem: WS /equipments/{id}/ws` | conexão sempre aberta; provavelmente cai e reabre a cada ~155 s | 1 por computador com Windy | Tirar o prazo de 150 s ou a nuvem mandar uma mensagem de vida. |
| Defeito | **Avisos ao vivo de pedido (nuvem → PDVs e caixas da web)** (Delivery e pedidos online) | Nuvem (metrics-node) → `Conexões ao vivo abertas (PDVs e abas de caixa)` | a cada evento (pedido novo, status, cancelamento, exclusão) | Hoje: TODAS as lojas conectadas | Mandar só para a loja do pedido, tirar o envio fixo para db_restaurante e casar a loja pelo nome exato. |
| Excessivo | **Barra de entregas do caixa na web** (Delivery e pedidos online) | Navegador, tela do caixa (/cashier/session/:id) → `Nuvem: GET /public/orders/pending?date=… e o canal ao vivo /public/orders/stream` | a cada 3 s (20 por minuto) com a aba visível, mesmo sem foco | 1 por aba de caixa aberta, inclusive caixa FECHADO ou CONFERIDO, datas passadas e loja sem delivery | Só com caixa ABERTO e do dia; 30-60 s com o canal ao vivo ligado e 10-15 s se ele cair; juntar avisos em rajada. |
| Excessivo | **Checagem de saúde da porta de entrada (coolify-proxy, Traefik)** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `wget /ping dentro do contêiner` | a cada 4 s |  | 60 s. |
| Excessivo | **Atualização da tela Delivery do PDV** (Delivery e pedidos online) | PDV com a tela Delivery aberta (servidor E terminal) → `Nuvem: GET /api/pdv/orders/pending?includeCancelled=1 (mais os reenvios abaixo)` | a cada 4 s (15 por minuto) enquanto a tela está visível | 1 por tela Delivery aberta, também no terminal | Ler só o banco local; o terminal nunca chama a nuvem. |
| Excessivo | **Checagens de saúde do próprio Coolify (coolify, coolify-db, coolify-redis, coolify-realtime)** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) | a cada 5 s, em 4 contêineres |  | 60 s pelo docker-compose.custom.yml (sobrevive às atualizações do Coolify). |
| Excessivo | **Checagem de saúde do Postgres das lojas** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `psql -U postgres -d db_marujo -c 'SELECT 1'` | a cada 5 s |  | 60 s; trocar por pg_isready (não faz login completo). |
| Excessivo | **Checagem de saúde do proxy da porta pública do banco** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `stat nginx.conf` | a cada 5 s |  | 60 s. Decidir depois: fechar a porta 5432 a quem não for o escritório (firewall da Hostinger). |
| Excessivo | **Checagem de saúde do Mongo** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `echo ok` | a cada 5 s |  | 60 s, ou desligar se ninguém usa. |
| Excessivo | **Coolify Sentinel (coleta de métricas)** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `API do Docker` | checagem a cada 10 s + coleta contínua |  | Desligar em Servers › localhost › Sentinel. |
| Excessivo | **Equipamentos e telemetria na web** (Ordens de serviço) | Navegador, /clients-equipments e aba Equipamentos de /treatments → `Nuvem: GET /clients (todos os clientes com todos os equipamentos) e /equipments/orphans` | 2 consultas a cada 10 s com a aba visível | 1 por aba da equipe interna | 30-60 s. |
| Excessivo | **Teste "Internet e nuvem" do PDV** (Empresa, usuários e configuração) | Todo PDV aberto (servidor e terminal) → `Nuvem: GET https://api.metrics.dev.br/health; também TCP com 1.1.1.1/8.8.8.8 e 256 KB da Cloudflare a cada 5 min` | ~20 s na janela principal, 12 s na tela de entrada | 1 por PDV aberto | Usar /public/health a cada 60 s. |
| Excessivo | **Cardápio completo e complementos (PDV)** (Cardápio e produtos) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /public/menu` | a cada 5 min (sincronia geral do PDV), SEMPRE tudo | 1 por loja | Obedecer ao carimbo de última mudança, como os produtos já fazem. |
| Excessivo | **Metrics.Sync: envio do catálogo do ERP para a nuvem** (Cardápio e produtos) | Computador da loja com o Metrics.Sync (Athos, Excel…) → `Nuvem: POST /api/pdv/sync/products/bulk` | a cada 5 min (padrão, configurável) e a cada mudança da planilha | Só lojas com integração de ERP; ⌈produtos/250⌉ lotes por ciclo | Enviar só o que mudou desde o último envio, ou passar a 30-60 min. |
| Excessivo | **Clientes (PDV)** (Clientes) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/clients` | a cada 5 min (sincronia geral do PDV), sempre a lista inteira | 1 por loja | Usar o carimbo de mudança de clientes que /sync/status já devolve. |
| Excessivo | **Equipe do PDV (usuários e funcionários)** (RH e ponto) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/users?incluirFuncionarios=1` | a cada 5 min (sincronia geral do PDV), sempre a lista inteira | 1 por loja | Usar o carimbo de mudança de usuários (já devolvido por /sync/status) ou 30 min; não recalcular quando nada mudou. |
| Excessivo | **Descobrir a loja de cada requisição** (SaaS (banco master)) | Nuvem (metrics-node), em toda requisição → `Banco master (tabela Tenant)` | a cada requisição | Multiplica todas as sondagens acima (~34 por minuto por loja) | Memória de 30-60 s. |
| Atenção | **Netdata (monitor do servidor)** (Servidor da nuvem (Hostinger + Coolify)) | Servidor | coleta a cada 1 s |  | Fechar a 19999 no firewall da Hostinger e usar o Netdata Cloud com alerta de CPU acima de 30% na média de 1 h. |
| Atenção | **Limpeza dos avisos de pedido** (Empresa, usuários e configuração) | Todo PDV aberto → `Banco da loja` | a cada 4 s |  | Desligar ao fechar a janela. |
| Atenção | **Reenvio de status e de delivery feito no PDV** (Delivery e pedidos online) | PDV aberto no computador servidor da loja → `Nuvem: PATCH /api/pdv/orders/{id}/status e POST /api/pdv/orders` | a cada volta do vigia (5 s) e da tela Delivery (4 s), sem esperar mais a cada falha | 1 por pedido com status à frente do da nuvem ou ainda não enviado (sem limite de data) | Esperar mais a cada falha (como as vendas já fazem) e só pedidos do dia. |
| Atenção | **Central VPN (Headscale) na web** (Ordens de serviço) | Navegador, aba Rede VPN de /treatments → `Nuvem: GET /vpn/networks (2 consultas + chamada ao Headscale)` | a cada 10 s com a aba visível | 1 por aba da equipe interna | 60 s (já existe o botão Atualizar). |
| Atenção | **"Estou vivo" da troca automática de servidor** (Empresa, usuários e configuração) | Core Service de todo computador da loja → `Nuvem: POST /api/pdv/cluster/vivo (só memória)` | a cada 15 s (ciclo de 10 s) | Todo computador, só se a "ordem dos servidores" estiver configurada (inclusive terminal fora da ordem) | Terminal fora da ordem não chamar. |
| Atenção | **Consulta de eventos do iFood (polling)** (Delivery e pedidos online) | Nuvem (metrics-node), dentro do processo da API → `iFood (events:polling) e o banco de cada loja` | a cada 30 s | Percorre todas as lojas ativas (~14), uma de cada vez | Pular lojas sem token; limpeza do diário (ex.: 30 dias), mantendo os eventos de cancelamento da homologação; não ligar fora do servidor de produção. |
| Atenção | **Posição de estoque na web** (Estoque e compras) | Navegador, /stock aba 1 → `Nuvem: GET /api/stock/overview` | a cada 30 s com a aba visível | 1 por aba aberta | Tirar a atualização automática ou passar a 5 min. |
| Atenção | **Consultas ao Docker com tamanho dos contêineres** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) | ~1 por minuto |  | Medir de novo depois de desligar o Sentinel e do teste de parar o Coolify por 10 min. |
| Atenção | **Windy: telemetria do computador** (Ordens de serviço) | Computador da loja com o Windy → `Nuvem: POST /equipments/{id}/telemetry (~2-4 KB)` | a cada 2 min, mais a cada reabertura da conexão e ao abrir o painel | 1 por computador | 5-10 min. |
| Atenção | **Retrato das mesas abertas para a nuvem** (Mesas e salão) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: POST /api/pdv/sync/tables` | a cada 5 min (sincronia geral do PDV), sempre (mesmo sem mesa aberta) | 1 por loja | Pular quando nada mudou desde o último envio. |
| Atenção | **Custos dos produtos (PDV)** (Cardápio e produtos) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/costs` | a cada 5 min (sincronia geral do PDV), sempre a tabela inteira | 1 por loja | Obedecer ao carimbo de mudança ou passar a 30 min. |
| Atenção | **Formas de pagamento, identificadores, maquininhas e condições (PDV)** (Financeiro) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /payments, /payment-identifiers, /pos-machines, /payment-conditions` | a cada 5 min (sincronia geral do PDV) (4 chamadas) | 1 por loja | 30-60 min ou carimbo de mudança. |
| Atenção | **Departamentos de impressão (PDV)** (Impressão e registro da operação) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/print-departments` | a cada 5 min (sincronia geral do PDV) |  | 30 min ou carimbo de mudança. |
| Atenção | **Configurações da loja (PDV)** (Empresa, usuários e configuração) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/config` | a cada 5 min (sincronia geral do PDV) |  | 30 min. |
| Atenção | **Backup do Postgres das lojas pelo Coolify** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) → `pg_dumpall + pigz + mc` | de hora em hora |  | 1 vez por dia (0 8 * * *), 3 cópias no servidor e 30 no R2 "backups"; depois ensaiar a restauração. |
| Atenção | **Relay do Syncthing (strelaysrv)** (Servidor da nuvem (Hostinger + Coolify)) | Servidor | sempre ligado |  | Identificar quem o inicia e remover. |
| Atenção | **Moodle e MariaDB** (Servidor da nuvem (Hostinger + Coolify)) | Servidor (Docker) | parados em 08/10/2026 |  | Decidir se voltam (docker start nos dois) ou se saem de vez. |
| Atenção | **Descobrir de qual loja é um evento do iFood ou da 99** (Delivery e pedidos online) | Nuvem (metrics-node) | a cada evento; memória de 10 min | Por evento | Guardar também o "não achei" por alguns minutos. |
| Atenção | **Registro (log) de toda requisição** (SaaS (banco master)) | Nuvem (metrics-node) | 2 linhas por requisição |  | Registrar só avisos e erros (nível warn), mantendo os erros completos. |
| Atenção | **Motores do Prisma (um processo por banco de loja)** (SaaS (banco master)) | Nuvem (metrics-node) | sempre ligados | ~14-16 processos query-engine (1 por banco), nunca fechados; o polling do iFood mantém todos acordados | Ensaio com o motor padrão (library) e medir; descobrir por que "binary" foi escolhido (arquivos travados no Windows?). |
| Ok | **Troca de servidor: cópia do banco** (Empresa, usuários e configuração) | Core Service de todo computador da ordem → `Postgres da loja (rede local)` | a cada 1 s (2 s fora do servidor) |  |  |
| Ok | **Página de diagnóstico do iFood** (Delivery e pedidos online) | Navegador com /delivery/ifood/diag aberto (equipe) → `Nuvem: /delivery/ifood/diag/data (até 400 linhas do diário)` | a cada 3 s enquanto aberta | Só quando alguém da equipe deixa a página aberta |  |
| Ok | **Comandas em modo gráfico** (Impressão e registro da operação) | PDV do servidor com o modo gráfico ligado → `Banco da loja e impressoras` | a cada 3 s |  |  |
| Ok | **Tela da cozinha (KDS): itens** (Impressão e registro da operação) | TV ou box da cozinha → `Core Service da loja: /api/kds/items` | a cada 5 s | 1 por tela de cozinha |  |
| Ok | **Ligação do terminal com o servidor** (Empresa, usuários e configuração) | PDV de terminal → `Banco do servidor da loja` | a cada 5 s (dados da loja a cada 1 min) |  |  |
| Ok | **Situação da troca de servidor no PDV** (Empresa, usuários e configuração) | Todo PDV aberto → `Core Service local: /api/cluster/situacao` | a cada 5 s (avisos do banco a cada 15 s) |  |  |
| Ok | **Situação da atualização no PDV** (Empresa, usuários e configuração) | Todo PDV aberto → `Core Service local: /api/update/status` | a cada 5 s |  |  |
| Ok | **Vigia da configuração do computador** (Empresa, usuários e configuração) | Core Service de todo computador → `Arquivo config_terminal.json` | a cada 5 s |  |  |
| Ok | **Caixa do servidor visto pelo terminal** (Caixa e vendas) | PDV de terminal sem caixa próprio, tela Caixa aberta → `Banco do servidor da loja` | a cada 10 s |  |  |
| Ok | **Verificação ao vivo (SEFAZ e certificado)** (Fiscal (NFC-e)) | Todo PDV aberto → `SEFAZ (com limite)` | itens locais a cada 10 s; SEFAZ a cada 15 min (3 min na tela de entrada) |  |  |
| Ok | **Impressão por departamento (comandas)** (Impressão e registro da operação) | Core Service do servidor da loja → `Banco da loja e impressoras` | aviso instantâneo do banco + conferência a cada 10 s |  |  |
| Ok | **Troca de servidor: ciclo de conferência** (Empresa, usuários e configuração) | Core Service de todo computador → `Banco do servidor e http://IP:5000/api/cluster/estado` | a cada 10 s |  |  |
| Ok | **Sinais do menu do PDV** (Empresa, usuários e configuração) | Todo PDV aberto → `Banco e Core Service locais` | a cada 10 s |  |  |
| Ok | **Ícone da bandeja (TrayMonitor)** (Empresa, usuários e configuração) | Todo computador da loja → `localhost:5000/health` | a cada 10 s |  |  |
| Ok | **Entrega do "caixa sem servidor"** (Caixa e vendas) | Core Service de todo computador da loja → `Core Service do servidor (não chama a nuvem)` | a cada 15 s, só se houver fila |  |  |
| Ok | **App do garçom: lista de mesas** (Mesas e salão) | Celular do garçom → `Core Service da loja: /api/garcom/mesas, /impressoras, /equipe (não chama a nuvem)` | a cada 15 s (equipe a cada 60 s) | 1 por celular |  |
| Ok | **App do garçom: mesa aberta na tela** (Mesas e salão) | Celular do garçom → `Core Service da loja: /api/garcom/mesas/{id}` | a cada 15 s | 1 por celular com uma mesa aberta |  |
| Ok | **Vigia das impressoras** (Impressão e registro da operação) | Core Service do servidor da loja → `Impressoras (rede) e banco da loja` | a cada 15 s |  |  |
| Ok | **Presença do computador no banco** (Empresa, usuários e configuração) | Core Service de todo computador → `Banco da loja (computadores_loja)` | a cada 15 s |  |  |
| Ok | **Salão do PDV (mesas ociosas e recarga)** (Mesas e salão) | PDV com o Salão aberto → `Banco da loja (não chama a nuvem)` | a cada 20 s | 1 por Salão aberto |  |
| Ok | **Relógio de ponto: envio de batidas** (RH e ponto) | Computador do Metrics.Ponto → `Nuvem: POST /hr/time-clock/sync-offline (normalmente nenhuma chamada)` | a cada 30 s, só se houver batida não enviada |  |  |
| Ok | **Contingência da NFC-e** (Fiscal (NFC-e)) | Core Service do servidor da loja → `Banco da loja; SEFAZ só com pendência` | a cada 30 s; SEFAZ só se houver nota pendente |  |  |
| Ok | **App do garçom: lista de servidores da loja** (Mesas e salão) | Celular do garçom → `Core Service da loja: /api/cluster/servidores` | a cada 60 s | 1 por celular |  |
| Ok | **Publicação dos dados da loja** (Empresa, usuários e configuração) | Core Service do servidor → `Banco da loja` | a cada 1 min |  |  |
| Ok | **Envio de vendas, caixas e cancelamentos para a nuvem** (Caixa e vendas) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: /api/pdv/sync/sales, /sync/cashier/open\|movements\|close, /sync/cancellations` | venda: na hora; o resto a cada 5 min (sincronia geral do PDV), só se houver pendência | 1 por loja |  |
| Ok | **Produtos que mudaram (PDV) e o carimbo de mudança** (Cardápio e produtos) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/status (4 contas) e, só se mudou, GET /api/pdv/products?lastSync=` | a cada 5 min (sincronia geral do PDV) | 1 por loja | Baixar a foto só quando a foto mudou (melhoria pequena). |
| Ok | **Relógio de ponto: lista de funcionários** (RH e ponto) | Computador do Metrics.Ponto → `Nuvem: GET /hr/employees/sync` | ao abrir e a cada 30 min |  |  |
| Ok | **Procura de atualização do PDV** (Empresa, usuários e configuração) | Core Service de todo computador → `Nuvem: GET /api/public/pdv/latest` | a cada 30 min |  |  |
| Ok | **Limpeza das marcas de "já recebido"** (Empresa, usuários e configuração) | Core Service do servidor → `Banco da loja` | a cada 1 h |  |  |
| Ok | **Tabela de impostos aproximados (IBPT)** (Fiscal (NFC-e)) | Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/ibpt (lotes de 100)` | no máximo a cada 6 h (30 min se faltar algum NCM) |  |  |
| Ok | **Canal ao vivo de pedidos no PDV (SSE)** (Delivery e pedidos online) | PDV aberto no computador servidor da loja → `Nuvem: /api/pdv/orders/stream` | conexão sempre aberta; se cair, tenta de novo a cada 5 s | 1 por PDV servidor (protegido contra duplicar) |  |

## Servidor da nuvem (Hostinger + Coolify)

Um único servidor virtual da Hostinger (KVM 2: 2 núcleos, 8 GB) roda tudo: a API, a web, o Postgres de todas as lojas, o Coolify (o painel que publica), o Traefik (a porta de entrada), Mongo, Redis, Headscale (VPN), RustDesk e o Netdata. A Hostinger usa "créditos de CPU": acima de 30% de uso gasta crédito; quando acaba, limita o servidor a 20% (foi o que deixou tudo lento em 07 e 08/10/2026). Medido em 08/10: o próprio Docker (dockerd ~45% + containerd ~50% de um núcleo) gasta sozinho cerca de metade do servidor o tempo todo; a API, o Postgres e o Coolify somam pouco (~5%, ~3% e ~6%). As checagens de saúde abaixo são os valores padrão do Coolify: ninguém do time escolheu esses números.

### Checagem de saúde da porta de entrada (coolify-proxy, Traefik) — Excessivo
- **Frequência:** a cada 4 s
- **Onde roda:** Servidor (Docker) → `wget /ping dentro do contêiner`
- **A cada vez:** Cada checagem faz o Docker criar um processo novo dentro do contêiner (runc), o que gasta CPU no dockerd e no containerd.
- **Por que existe:** O Coolify mostra se a porta de entrada está de pé.
- **Se espaçar:** Se o Traefik cair, o painel leva até ~3 min para mostrar (60 s × 3 tentativas). As lojas não dependem desta checagem.
- **Proposta:** 60 s.
- **Onde no código:** `Coolify › Servers › localhost › Proxy (docker-compose do Traefik)`

### Checagens de saúde do próprio Coolify (coolify, coolify-db, coolify-redis, coolify-realtime) — Excessivo
- **Frequência:** a cada 5 s, em 4 contêineres
- **Onde roda:** Servidor (Docker)
- **A cada vez:** 4 processos novos a cada 5 s (48 por minuto).
- **Por que existe:** O Coolify sabe se as peças dele estão de pé (painel, banco, fila, tempo real).
- **Se espaçar:** Depois de atualizar o Coolify, ele demora mais para se declarar saudável, a não ser com uma checagem rápida só na partida (start_interval, Docker 25 ou mais novo: conferir com docker version).
- **Proposta:** 60 s pelo docker-compose.custom.yml (sobrevive às atualizações do Coolify).
- **Onde no código:** `/data/coolify/source/docker-compose.prod.yml (padrão do Coolify)`, `/data/coolify/source/docker-compose.custom.yml (onde ajustar)`

### Checagem de saúde do Postgres das lojas — Excessivo
- **Frequência:** a cada 5 s
- **Onde roda:** Servidor (Docker) → `psql -U postgres -d db_marujo -c 'SELECT 1'`
- **A cada vez:** Abre uma conexão nova no banco de produção a cada 5 s (login e um processo novo do Postgres). Depende do banco do Marujo existir.
- **Por que existe:** O Coolify sabe se o banco de todas as lojas está de pé.
- **Se espaçar:** Se o banco cair, o painel leva até ~3 min para mostrar; nada reinicia sozinho por causa desta checagem.
- **Proposta:** 60 s; trocar por pg_isready (não faz login completo).
- **Onde no código:** `Coolify › banco das lojas › Healthcheck (aplicar exige reiniciar o banco, à noite)`

### Checagem de saúde do proxy da porta pública do banco — Excessivo
- **Frequência:** a cada 5 s
- **Onde roda:** Servidor (Docker) → `stat nginx.conf`
- **Por que existe:** O contêiner existe porque o banco está "publicamente acessível" no Coolify (porta 5432 aberta).
- **Proposta:** 60 s. Decidir depois: fechar a porta 5432 a quem não for o escritório (firewall da Hostinger).
- **Onde no código:** `Coolify › banco das lojas › Make it publicly available`

### Checagem de saúde do Mongo — Excessivo
- **Frequência:** a cada 5 s
- **Onde roda:** Servidor (Docker) → `echo ok`
- **A cada vez:** Só prova que o contêiner aceita comandos. Quem usa este Mongo: a identificar.
- **Por que existe:** O Coolify sabe se o Mongo está de pé.
- **Proposta:** 60 s, ou desligar se ninguém usa.
- **Onde no código:** `Coolify › recurso do Mongo › Healthcheck`

### Coolify Sentinel (coleta de métricas) — Excessivo
- **Frequência:** checagem a cada 10 s + coleta contínua
- **Onde roda:** Servidor (Docker) → `API do Docker`
- **A cada vez:** Consulta o Docker sem parar. Parado à mão, o Coolify religa sozinho.
- **Por que existe:** Gráficos de CPU e memória dentro do Coolify.
- **Se espaçar:** O Netdata já mede tudo isso.
- **Proposta:** Desligar em Servers › localhost › Sentinel.
- **Onde no código:** `Coolify › Servers › localhost › Sentinel`

### Netdata (monitor do servidor) — Atenção
- **Frequência:** coleta a cada 1 s
- **Onde roda:** Servidor
- **A cada vez:** Custo pequeno. A porta 19999 está aberta para a internet, sem senha.
- **Por que existe:** Ver CPU, memória e processos do servidor (foi o que achou a causa em 08/10).
- **Proposta:** Fechar a 19999 no firewall da Hostinger e usar o Netdata Cloud com alerta de CPU acima de 30% na média de 1 h.
- **Onde no código:** `Serviço netdata, porta 19999`

### Consultas ao Docker com tamanho dos contêineres — Atenção
- **Frequência:** ~1 por minuto
- **Onde roda:** Servidor (Docker)
- **A cada vez:** "size=true" faz o Docker medir o disco de cada contêiner, que é pesado; sob o limite, estouram o tempo.
- **Por que existe:** Alguém (provável painel do Coolify ou Sentinel: a confirmar) lista contêineres e imagens.
- **Proposta:** Medir de novo depois de desligar o Sentinel e do teste de parar o Coolify por 10 min.
- **Onde no código:** `logs do dockerd: /containers/json?all=true&size=true e /images/json canceladas`

### Backup do Postgres das lojas pelo Coolify — Atenção
- **Frequência:** de hora em hora
- **Onde roda:** Servidor (Docker) → `pg_dumpall + pigz + mc`
- **A cada vez:** Pico de CPU a cada hora.
- **Por que existe:** Cópia de segurança de todas as lojas.
- **Proposta:** 1 vez por dia (0 8 * * *), 3 cópias no servidor e 30 no R2 "backups"; depois ensaiar a restauração.
- **Onde no código:** `Coolify › banco das lojas › Backups`

### Relay do Syncthing (strelaysrv) — Atenção
- **Frequência:** sempre ligado
- **Onde roda:** Servidor
- **Por que existe:** Sobra de uma instalação antiga ("removido"), mas o processo ainda aparece no Netdata usando CPU.
- **Proposta:** Identificar quem o inicia e remover.
- **Onde no código:** `Netdata › Applications`

### Moodle e MariaDB — Atenção
- **Frequência:** parados em 08/10/2026
- **Onde roda:** Servidor (Docker)
- **Por que existe:** Plataforma de cursos instalada no servidor.
- **Proposta:** Decidir se voltam (docker start nos dois) ou se saem de vez.
- **Onde no código:** `contêineres moodle-9aj5… e mariadb-9aj5…`

Como medir numa crise: (1) hPanel da Hostinger › CPU (a linha de 30% é o limite dos créditos); (2) Netdata › Applications: dockerd e containerd altos = checagens de saúde ou consultas ao Docker; node alto = API; postgres alto = consultas das lojas; (3) no terminal do servidor, docker inspect --format "{{json .Config.Healthcheck}}" <contêiner> mostra a checagem de cada contêiner e docker events --filter event=exec_start mostra cada checagem acontecendo.

Serviços sempre ligados que não são trabalhos periódicos: API (metrics-node), web (metrics-frontend), Headscale e a tela dele, RustDesk (hbbs e hbbr), Redis, Traefik.

## Por módulo

As fichas completas de cada módulo ficam no `.md` do módulo, na seção "Trabalhos que rodam o tempo todo".

- [Caixa e vendas](caixa-vendas.md): 3
- [Mesas e salão](mesas.md): 6
- [Delivery e pedidos online](delivery.md): 9
- [Cardápio e produtos](cardapio.md): 6
- [Estoque e compras](estoque.md): 1
- [Financeiro](financeiro.md): 1
- [Clientes](clientes.md): 1
- [Ordens de serviço](servicos.md): 4
- [RH e ponto](rh.md): 3
- [Fiscal (NFC-e)](fiscal.md): 4
- [Impressão e registro da operação](impressao.md): 5
- [Empresa, usuários e configuração](empresa.md): 16
- [SaaS (banco master)](saas.md): 3
