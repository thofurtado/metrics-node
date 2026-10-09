# Empresa, usuários e configuração

> Gerado por `atlas.py` em 09/10/2026 a partir do código e de `modulos/empresa.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Usuários do sistema e seus módulos liberados, o perfil da empresa (White Label do cardápio, horários, setores de entrega) e as configurações gerais.

## Trabalhos que rodam o tempo todo

### Teste "Internet e nuvem" do PDV — Excessivo
- **Frequência:** ~20 s na janela principal, 12 s na tela de entrada
- **Onde roda:** Todo PDV aberto (servidor e terminal) → `Nuvem: GET https://api.metrics.dev.br/health; também TCP com 1.1.1.1/8.8.8.8 e 256 KB da Cloudflare a cada 5 min`
- **Quantos:** 1 por PDV aberto
- **A cada vez:** /health passa pelo filtro da loja (1 consulta ao master) e provavelmente responde 403. Existe /public/health, que é barata.
- **Por que existe:** Mostrar se a loja está com internet e se a nuvem responde.
- **Proposta:** Usar /public/health a cada 60 s.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Services/MonitorConexao.cs:33`, `Metrics.PDV/Metrics.PDV/Services/VerificacaoAoVivo.cs:138`

### Limpeza dos avisos de pedido — Atenção
- **Frequência:** a cada 4 s
- **Onde roda:** Todo PDV aberto → `Banco da loja`
- **A cada vez:** Também nunca é desligado: soma um a cada "Bloquear sessão".
- **Por que existe:** Tirar da tela os avisos de pedido já tratados.
- **Proposta:** Desligar ao fechar a janela.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/MainWindow.xaml.cs:157`

### "Estou vivo" da troca automática de servidor — Atenção
- **Frequência:** a cada 15 s (ciclo de 10 s)
- **Onde roda:** Core Service de todo computador da loja → `Nuvem: POST /api/pdv/cluster/vivo (só memória)`
- **Quantos:** Todo computador, só se a "ordem dos servidores" estiver configurada (inclusive terminal fora da ordem)
- **Por que existe:** A nuvem é o juiz da troca de servidor: conta como vivo quem falou há menos de 60 s; o PDV descarta a resposta depois de 45 s.
- **Se espaçar:** Não passar de 20-30 s sem mudar as regras de 45 e 60 s.
- **Proposta:** Terminal fora da ordem não chamar.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Cluster/CoordenadorCluster.cs:167`, `metrics-node/src/modules/pdv-sync/services/cluster-judge.ts:4`

### Configurações da loja (PDV) — Atenção
- **Frequência:** a cada 5 min (sincronia geral do PDV)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/config`
- **Por que existe:** Configuração feita na web chega ao PDV.
- **Proposta:** 30 min.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:1249`

### Troca de servidor: cópia do banco — Ok
- **Frequência:** a cada 1 s (2 s fora do servidor)
- **Onde roda:** Core Service de todo computador da ordem → `Postgres da loja (rede local)`
- **Por que existe:** Manter a cópia do banco pronta para outro computador assumir se o servidor cair.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Cluster/CoordenadorCluster.cs:368`

### Ligação do terminal com o servidor — Ok
- **Frequência:** a cada 5 s (dados da loja a cada 1 min)
- **Onde roda:** PDV de terminal → `Banco do servidor da loja`
- **Por que existe:** Perceber a queda do servidor e avisar o caixa.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/ConexaoServidorMonitor.cs:57`

### Situação da troca de servidor no PDV — Ok
- **Frequência:** a cada 5 s (avisos do banco a cada 15 s)
- **Onde roda:** Todo PDV aberto → `Core Service local: /api/cluster/situacao`
- **Por que existe:** Mostrar no PDV quem é o servidor e se houve troca.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Services/TrocaDeServidorNoPdv.cs:61`

### Situação da atualização no PDV — Ok
- **Frequência:** a cada 5 s
- **Onde roda:** Todo PDV aberto → `Core Service local: /api/update/status`
- **Por que existe:** Mostrar o andamento do botão Atualizar.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Services/PdvUpdateClient.cs:48`

### Vigia da configuração do computador — Ok
- **Frequência:** a cada 5 s
- **Onde roda:** Core Service de todo computador → `Arquivo config_terminal.json`
- **Por que existe:** Perceber troca de papel (servidor/terminal) ou de banco sem reiniciar.
- **Onde no código:** `Metrics.PDV/Metrics.CoreService/Program.cs:121`

### Troca de servidor: ciclo de conferência — Ok
- **Frequência:** a cada 10 s
- **Onde roda:** Core Service de todo computador → `Banco do servidor e http://IP:5000/api/cluster/estado`
- **Por que existe:** Ler a ordem dos servidores e perguntar o estado dos outros computadores.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Cluster/CoordenadorCluster.cs:142`

### Sinais do menu do PDV — Ok
- **Frequência:** a cada 10 s
- **Onde roda:** Todo PDV aberto → `Banco e Core Service locais`
- **Por que existe:** Luzes do menu: impressoras, caixa sem servidor.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/MainWindow.xaml.cs:104`

### Ícone da bandeja (TrayMonitor) — Ok
- **Frequência:** a cada 10 s
- **Onde roda:** Todo computador da loja → `localhost:5000/health`
- **Por que existe:** A cor do ícone diz se o Core Service está de pé.
- **Onde no código:** `Metrics.PDV/Metrics.TrayMonitor/App.xaml.cs:43`

### Presença do computador no banco — Ok
- **Frequência:** a cada 15 s
- **Onde roda:** Core Service de todo computador → `Banco da loja (computadores_loja)`
- **Por que existe:** Lista de computadores da loja com a última vez que foram vistos.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Cluster/CoordenadorCluster.cs:201`

### Publicação dos dados da loja — Ok
- **Frequência:** a cada 1 min
- **Onde roda:** Core Service do servidor → `Banco da loja`
- **Por que existe:** Terminais e celulares sabem nome, servidor e configuração da loja.
- **Onde no código:** `Metrics.PDV/Metrics.CoreService/Program.cs:745`

### Procura de atualização do PDV — Ok
- **Frequência:** a cada 30 min
- **Onde roda:** Core Service de todo computador → `Nuvem: GET /api/public/pdv/latest`
- **Por que existe:** Saber se há versão nova para o botão Atualizar.
- **Onde no código:** `Metrics.PDV/Metrics.CoreService/Services/CoreServiceUpdateAgent.cs:149`

### Limpeza das marcas de "já recebido" — Ok
- **Frequência:** a cada 1 h
- **Onde roda:** Core Service do servidor → `Banco da loja`
- **Por que existe:** Apagar as marcas antigas que evitam gravar a mesma venda duas vezes.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/IdempotenciaCleanupBackgroundService.cs:33`

## Tabelas e Estrutura de Dados

### Usuário (`users`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quem faz login no sistema (web, PDV, app), com papel (ADMIN…).
- **Espelho no PDV/nuvem:** Usuário (PDV) (`users`)

### Módulo liberado (`modules`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Módulo do sistema que pode ser liberado para um usuário.

### Usuário × módulo (`user_modules`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quais módulos cada usuário acessa.

### Perfil da empresa (`company_profiles`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Nome, contato, White Label do cardápio (tema, bairros, Pix), integrações.

### Horário de funcionamento (`business_hours`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Horários do cardápio online por dia da semana.

### Configuração do sistema (`system_configs`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Módulos ligados, fechamento cego, perfil financeiro, cartões do painel e integrações.

### Integrações do cliente (`tenant_integrations`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Uma linha por serviço de fora ligado pelo cliente em Configurações > Integrações: De Olho no Imposto (IBPT: token e CNPJ da empresa) e 99Food (id da loja). Criada em 25/09/2026.
- **Quem grava:** Web → Configurações > Integrações (o token do IBPT é testado no IBPT antes de salvar).
- **Quem lê:** PDV, pela rota /api/pdv/sync/ibpt (o backend consulta o IBPT com o token; o token nunca vai ao PDV) e a entrada de pedidos da 99Food (de qual cliente é a loja).
- **Cresce:** Uma linha por serviço: poucas linhas por cliente.

### Usuário (PDV) (`users`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local dos usuários, baixada a cada ciclo (usuário que sumiu da nuvem é apagado do PDV).
- **Espelho no PDV/nuvem:** Usuário (`users`)

### Configuração (PDV) (`configuracoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Chave e valor das configurações do terminal (ex.: Fiscal.ValidacaoRigorosa, total de mesas).

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Usuário (PDV) | Usuário | Mesmo código; baixado a cada ciclo. |
