# Mesas e salão

> Gerado por `atlas.py` em 09/10/2026 a partir do código e de `modulos/mesas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Mesa e comanda abertas. No PDV a mesa é um atendimento com pedidos; na nuvem existe só uma foto ao vivo das mesas abertas, sem ligação com venda ou caixa. Quando a mesa é paga, sai da foto e vira venda (módulo Caixa e vendas).

## Trabalhos que rodam o tempo todo

### Mesas ao vivo na web (aba Mesas do caixa) — Defeito
- **Frequência:** a cada 10 s com a aba visível
- **Onde roda:** Navegador, /cashier aba Mesas → `Nuvem: GET /pdv/sync/tables/snapshot`
- **Quantos:** 1 por aba aberta
- **A cada vez:** A rota exige uma chave (x-api-key) que a web não manda: responde sempre 401, a tela nunca funcionou e paga só a consulta ao master. Sem dados, a tela mostra mesas inventadas ("Lucas Silva"), que confundem.
- **Por que existe:** Gerente ou dono ver o salão de longe.
- **Proposta:** Consertar a autorização, passar a 30 s (ou receber pelo canal ao vivo) e tirar as mesas de exemplo.
- **Onde no código:** `metrics/src/pages/app/cashier/components/LiveTablesView.tsx:69`, `metrics/src/pages/app/cashier/components/LiveTablesView.tsx:95`, `metrics-node/src/modules/pdv-sync/http/controllers/routes.ts:41`

### Retrato das mesas abertas para a nuvem — Atenção
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre (mesmo sem mesa aberta)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: POST /api/pdv/sync/tables`
- **Quantos:** 1 por loja
- **A cada vez:** A nuvem grava cada mesa e apaga e recria os itens um por um.
- **Por que existe:** Alimentar o painel do dono e as mesas ao vivo da web.
- **Proposta:** Pular quando nada mudou desde o último envio.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:464`, `metrics-node/src/modules/pdv-sync/http/controllers/tables-sync-controller.ts:11`

### App do garçom: lista de mesas — Ok
- **Frequência:** a cada 15 s (equipe a cada 60 s)
- **Onde roda:** Celular do garçom → `Core Service da loja: /api/garcom/mesas, /impressoras, /equipe (não chama a nuvem)`
- **Quantos:** 1 por celular
- **Por que existe:** Ver as mesas abertas e lançadas por outros garçons e pelo caixa.
- **Onde no código:** `metrics-garcom/app/src/main/java/com/example/metricsgarcom/ui/GarcomViewModel.kt:249`

### App do garçom: mesa aberta na tela — Ok
- **Frequência:** a cada 15 s
- **Onde roda:** Celular do garçom → `Core Service da loja: /api/garcom/mesas/{id}`
- **Quantos:** 1 por celular com uma mesa aberta
- **Por que existe:** Ver na hora o que foi lançado na mesa por outra pessoa.
- **Onde no código:** `metrics-garcom/app/src/main/java/com/example/metricsgarcom/ui/atendimento/MesaDetalhesScreen.kt:69`

### Salão do PDV (mesas ociosas e recarga) — Ok
- **Frequência:** a cada 20 s
- **Onde roda:** PDV com o Salão aberto → `Banco da loja (não chama a nuvem)`
- **Quantos:** 1 por Salão aberto
- **Por que existe:** Atualizar tempos, mesas ociosas e o que outros computadores e celulares lançaram.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Views/MesasView.xaml.cs:226`

### App do garçom: lista de servidores da loja — Ok
- **Frequência:** a cada 60 s
- **Onde roda:** Celular do garçom → `Core Service da loja: /api/cluster/servidores`
- **Quantos:** 1 por celular
- **Por que existe:** Saber para qual computador ir se o servidor da loja cair (troca automática de servidor).
- **Onde no código:** `metrics-garcom/app/src/main/java/com/example/metricsgarcom/data/api/GarcomApiClient.kt:266`

## Tabelas e Estrutura de Dados

### Mesa aberta (`active_tables`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** A foto das mesas e comandas abertas agora.
- **Quem grava:** O PDV, a cada ciclo de 5 minutos (a mesa fechada sai da foto). O garçom no modo pela internet também abre mesa aqui.
- **Quem lê:** O garçom pela internet. O painel de mesas da web lê uma cópia em memória do mesmo envio do PDV, não esta tabela.
- **Cresce:** Não cresce: no máximo o número de mesas abertas.
- **Espelho no PDV/nuvem:** Atendimento (mesa/comanda) (`atendimentos`)

### Item na mesa (`active_table_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Os itens de cada mesa aberta, na foto.
- **Quem grava:** O PDV (apaga e recria os itens de cada mesa a cada envio) e o garçom pela internet.

### Atendimento (mesa/comanda) (`atendimentos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** A mesa ou comanda aberta no PDV, com a situação (Em consumo, Ociosa, Conta, Livre) e o número de pessoas. Tem os pedidos da mesa.
- **Espelho no PDV/nuvem:** Mesa aberta (`active_tables`)

### Transferência (PDV) (`log_transferencias`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Registro de cada transferência de item ou de mesa inteira: origem, destino, item, valor, motivo e operador.
- **Quem grava:** MesasView, na mesma gravação da transferência (tudo ou nada, desde o PDV 2.4.17.2).
- **Quem lê:** Ninguém ainda: não há tela e não sobe para a nuvem.

### Lançamento do garçom já recebido (`garcom_idempotencia`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cada lançamento do app do garçom chega com uma chave criada no celular. A primeira vez lança os itens e guarda a resposta aqui; se o celular reenviar (internet caiu no meio, toque duplo), o servidor devolve a resposta guardada e não lança de novo. A mesma chave numa mesa diferente é recusada.
- **Quem grava:** Serviço do servidor da loja, ao receber o lançamento do app do garçom (LancamentoDoGarcom).
- **Quem lê:** O mesmo serviço, a cada lançamento, para saber se aquela chave já chegou.
- **Cresce:** Uma linha por lançamento do app; o servidor apaga as de mais de 2 dias (limpeza automática).

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Atendimento (mesa/comanda) | Mesa aberta | Pelo nome da mesa (identificador), só enquanto está aberta. |

## Pendências e decisões

- Confirmar se o garçom pela internet é usado; se for, o envio de mesas do PDV não pode apagar os itens dele.
- A venda não guarda de que mesa veio (proposta sales.origin_identifier, módulo Caixa e vendas).
