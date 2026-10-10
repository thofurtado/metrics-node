# Impressão e registro da operação

> Gerado por `atlas.py` em 10/10/2026 a partir do código e de `modulos/impressao.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Fica no banco do servidor da loja (PDV). O vigia das impressoras confere cada uma a cada 15 segundos; a comanda de cada item é registrada por departamento, para a falha do bar não reimprimir o papel da cozinha; e quem reimprime, desvia a impressora ou marca "já resolvi à mão" fica registrado. Nada disso vai para a nuvem.

## Trabalhos que rodam o tempo todo

### Departamentos de impressão (PDV) — Atenção
- **Frequência:** a cada 5 min (sincronia geral do PDV)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/print-departments`
- **Por que existe:** Trazer da web a lista de departamentos (cozinha, bar…) e as impressoras de cada um.
- **Proposta:** 30 min ou carimbo de mudança.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:1167`

### Comandas em modo gráfico — Ok
- **Frequência:** a cada 3 s
- **Onde roda:** PDV do servidor com o modo gráfico ligado → `Banco da loja e impressoras`
- **Por que existe:** O desenho gráfico só existe no PDV: ele imprime as comandas quando o modo gráfico está ligado.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/App.xaml.cs:171`

### Tela da cozinha (KDS): itens — Ok
- **Frequência:** a cada 5 s
- **Onde roda:** TV ou box da cozinha → `Core Service da loja: /api/kds/items`
- **Quantos:** 1 por tela de cozinha
- **Por que existe:** Mostrar na cozinha os itens a preparar.
- **Onde no código:** `metrics-kds/app/src/main/java/com/example/metrics_kdv/MainActivity.kt:74`

### Impressão por departamento (comandas) — Ok
- **Frequência:** aviso instantâneo do banco + conferência a cada 10 s
- **Onde roda:** Core Service do servidor da loja → `Banco da loja e impressoras`
- **Por que existe:** Comanda sai na cozinha ou no bar assim que o item é lançado; a conferência pega o que o aviso perdeu.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/DepartmentPrintWatcherBackgroundService.cs:39`

### Vigia das impressoras — Ok
- **Frequência:** a cada 15 s
- **Onde roda:** Core Service do servidor da loja → `Impressoras (rede) e banco da loja`
- **Por que existe:** Mostrar impressora desligada ou sem papel antes de a comanda se perder.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/VigiaDasImpressoras.cs:26`

## Tabelas e Estrutura de Dados

### Comanda do item por departamento (`impressoes_item`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** A situação do papel de UM item em UM departamento: impresso, falhou, sem impressora, resolvido à mão ou pedido de reimpressão. Com cozinha e bar no mesmo pedido, cada papel que saiu fica registrado aqui e não é impresso outra vez quando o outro falha.
- **Quem grava:** Serviço de impressão do servidor, a cada papel que sai ou falha; PDV na janela da comanda do item (Reimprimir, Já resolvi à mão).
- **Quem lê:** Salão, Dashboard e a janela da comanda do item (sinal de impresso, na fila ou alerta), o vigia das impressoras (itens esperando) e o app do garçom (situação de cada item).
- **Cresce:** Uma linha por item por departamento que imprime (ex.: 300 itens por dia que vão à cozinha = 300 linhas por dia). Não há limpeza automática.

### Situação da impressora (`impressoras_estado`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Uma linha por departamento com impressora: pronta, sem papel, tampa aberta, desligada; desde quando; quantos itens estão esperando; e o desvio ativo para outra impressora (até a virada do dia, às 05:00).
- **Quem grava:** Vigia das impressoras, no serviço do servidor, a cada 15 segundos e antes de cada comanda; PDV do servidor na janela Impressoras (desviar e voltar).
- **Quem lê:** Todos os PDVs (faixa de aviso no alto da tela, conferência da abertura, janela Impressoras) e o app do garçom pela rota do serviço.
- **Cresce:** Não cresce: uma linha por departamento de impressão.

### Registro de operações (`registro_operacoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Quem fez, quando e em qual aparelho as movimentações que alguém precisa conferir depois (decisão do Thomás de 05/10/2026): mesa reaberta por lançamento atrasado, lançamento entregue depois com o servidor fora, reimpressão, já resolvi à mão, desvio e volta de impressora, fila limpa.
- **Quem grava:** Serviço do servidor (lançamento do app do garçom) e PDV (janela da comanda do item e janela Impressoras).
- **Quem lê:** Ainda nenhuma tela: o registro é gravado para conferência.
- **Cresce:** Só as exceções: algumas linhas por dia. Não há limpeza automática.

## Notas

Como se ligam (nenhuma ligação tem chave no banco): a comanda do item acha o item do pedido pelo número (pedido_item_id) e o departamento de impressão pelo código (departamento_uuid); a situação da impressora acha o departamento pelo código; o registro de operações aponta a mesa ou comanda (atendimento_id) e, quando é de um item, o item (pedido_item_id). Um item apagado não apaga essas linhas.

## Pendências e decisões

- Tela para ver o registro de operações (hoje só no banco).
- Limpeza das comandas por item antigas (a tabela cresce com cada item impresso).
