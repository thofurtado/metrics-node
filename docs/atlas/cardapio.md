# Cardápio e produtos

> Gerado por `atlas.py` em 10/10/2026 a partir do código e de `modulos/cardapio.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Produtos, categorias, grupos de adicionais e seus itens, e os departamentos de impressão (para onde cada produto vai na cozinha). A nuvem é a fonte: o PDV baixa o cardápio a cada ciclo.

## Trabalhos que rodam o tempo todo

### Acompanhamento do pedido no cardápio (cliente) — Defeito
- **Frequência:** a cada 2,5 s (24 por minuto), sem parar nunca
- **Onde roda:** Celular ou computador do cliente, passo "Seu pedido" → `Nuvem: GET /public/orders/:id/status`
- **Quantos:** 1 por cliente com a tela aberta; no pico, dezenas por loja
- **A cada vez:** 1 consulta ao master e 1 busca do pedido pelo código (uuid), que não tem índice: lê a tabela de pedidos inteira. Não para quando o pedido é entregue, concluído ou cancelado, nem em erro. Pedido cancelado aparece como "Aguardando confirmação".
- **Por que existe:** Mostrar ao cliente em que etapa está o pedido (Aguardando → Entregue). Tela feita com muito esforço: mexer só na parada e no intervalo.
- **Se espaçar:** O servidor já manda notificação (web push) a cada mudança; a consulta é só reserva. Em 10-15 s, quem não aceitou notificação vê a mudança até 15 s depois.
- **Proposta:** Parar nos status finais e em 404; limite de ~3 h; 10-15 s; pausar com a tela escondida; mostrar "Cancelado".
- **Desde:** Conhecido desde 18/09/2026 ("a consulta de status nunca para")
- **Onde no código:** `metrics/src/pages/landings/GenericMenu.tsx:1966`, `metrics/src/pages/landings/GenericMenu.tsx:2036`, `metrics-node/src/modules/public/http/controllers/get-online-order-status.ts:18`

### Acompanhamento do pedido no cardápio do Marujo — Defeito
- **Frequência:** a cada 4 s (15 por minuto), sem parar nunca
- **Onde roda:** Celular ou computador do cliente do Marujo → `Nuvem: GET /public/orders/:id/status`
- **Quantos:** 1 por cliente do Marujo com a tela aberta
- **A cada vez:** Igual ao genérico. Pior: fechar a janela pelo fundo ou pelo ESC deixa a consulta rodando escondida até recarregar a página.
- **Por que existe:** O mesmo do cardápio genérico, na tela própria do Marujo.
- **Proposta:** A mesma correção do genérico e a consulta depender da janela aberta.
- **Onde no código:** `metrics/src/pages/landings/Marujo/MarujoMenu.tsx:510`, `metrics/src/pages/landings/Marujo/MarujoMenu.tsx:1310`

### Cardápio completo e complementos (PDV) — Excessivo
- **Frequência:** a cada 5 min (sincronia geral do PDV), SEMPRE tudo
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /public/menu`
- **Quantos:** 1 por loja
- **A cada vez:** Produtos com grupos e opções, todos os grupos, subcategorias e formas de pagamento, toda vez, mesmo sem mudança.
- **Por que existe:** Deixar o cardápio do PDV (complementos, grupos, subcategorias) igual ao da nuvem.
- **Se espaçar:** Obedecendo ao carimbo de "última mudança" (que já existe), só baixa quando algo mudou; mudança feita na web continua chegando em até 5 min.
- **Proposta:** Obedecer ao carimbo de última mudança, como os produtos já fazem.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SincronizacaoProdutoService.cs:23`, `metrics-node/src/modules/public/http/controllers/get-menu.ts:12`

### Custos dos produtos (PDV) — Atenção
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre a tabela inteira
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/costs`
- **Quantos:** 1 por loja
- **Por que existe:** Custo do produto no PDV (margem, relatórios).
- **Proposta:** Obedecer ao carimbo de mudança ou passar a 30 min.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SincronizacaoCustoService.cs:44`

### Metrics.Sync: envio do catálogo do ERP para a nuvem — Atenção
- **Frequência:** a cada 5 min (padrão, configurável) e a cada mudança da planilha
- **Onde roda:** Computador da loja com o Metrics.Sync (Athos, Excel…) → `Nuvem: POST /api/pdv/sync/products/bulk`
- **Quantos:** Só lojas com integração de ERP; ⌈produtos/250⌉ lotes por ciclo
- **A cada vez:** Desde o Sync 1.4.3.0 (09/10/2026) a rodada automática manda só os produtos novos ou alterados desde o último envio aceito (impressão digital de cada produto guardada no computador da loja); Sincronizar agora (manual) manda tudo. Antes mandava o catálogo inteiro toda vez e a nuvem procura cada produto pelo nome sem índice: na Katatau (3.200 produtos) eram ~10 milhões de linhas lidas a cada 5 minutos (22,9 bilhões em uma semana), 70% de um núcleo do banco.
- **Por que existe:** Manter o cardápio da nuvem igual ao do sistema antigo da loja (ERP).
- **Proposta:** Na nuvem, buscar os produtos da loja uma vez só e comparar na memória (o envio manual completo ainda faz uma busca sem índice por produto).
- **Onde no código:** `Metrics.Sync/Services/EnvioIncremental.cs:22`, `Metrics.Sync/Services/SyncOrchestrator.cs:205`, `Metrics.Sync/Models/SyncConfig.cs:18`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:497`

### Produtos que mudaram (PDV) e o carimbo de mudança — Ok
- **Frequência:** a cada 5 min (sincronia geral do PDV)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/status (4 contas) e, só se mudou, GET /api/pdv/products?lastSync=`
- **Quantos:** 1 por loja
- **A cada vez:** Traz TODOS os produtos ativos completos (código da nuvem, código de barras e dados fiscais limpos), não só os do cardápio online (nuvem 2.6.107.0 + PDV 2.5.17.0, 09/10/2026). Depois da atualização baixa tudo uma vez sozinho; o botão SINCRONIZAR API AGORA força a lista completa. Grava os códigos em 3 etapas numa transação, para dois produtos poderem trocar de código. Produto alterado com foto baixa a foto de novo, mesmo que ela não tenha mudado.
- **Por que existe:** Trazer para o PDV só os produtos alterados na nuvem (o carimbo evita baixar à toa). Regra do Thomás (09/10/2026): o PDV tem todos os produtos ativos; o cardápio online só os marcados Cardápio. Antes os 1.750 produtos da Katatau fora do cardápio ficavam no caixa com o código antigo, sem código de barras e sem NCM.
- **Proposta:** Baixar a foto só quando a foto mudou (melhoria pequena).
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:73`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:209`, `Metrics.PDV/Metrics.Shared/Services/CodigosDosProdutos.cs:26`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:12`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:311`

## Tabelas e Estrutura de Dados

### Produto (`products`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Produto vendido, com preço, custo, dados fiscais (NCM, CFOP, CSOSN), estoque e se aparece no cardápio online.
- **Quem grava:** Web → Mercadorias & Cardápio; importador Metrics.Sync.
- **Quem lê:** Cardápio online, PDV (baixa a cada ciclo), estoque, custo e delivery.

### Categoria (`categories`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Categoria do cardápio.

### Subcategoria (`subcategories`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Subdivisão de uma categoria.

### Grupo de adicionais (`complement_groups`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Grupo de opções de um produto (ex.: "Adicionais", "Ponto da carne"), com mínimo, máximo e quantidade grátis.

### Opção de adicional (`complement_options`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada opção do grupo, com preço e, se baixa estoque, o insumo e o consumo por porção.
- **Quem grava:** Web → aba Adicionais & Opcionais (campo Consumo por porção desde a web 2.6.20.3).

### Produto × grupo de adicionais (`product_complement_groups`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quais grupos de adicionais cada produto oferece, e em que ordem.

### Departamento de impressão (`print_departments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Setor da cozinha que recebe o pedido impresso (ex.: bar, chapa).

### Produto × departamento (`product_print_departments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Para quais departamentos cada produto é impresso.

### Produto (PDV) (`produtos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local do produto, baixada da nuvem, com o custo recebido pela rota de custos.
- **Espelho no PDV/nuvem:** Produto (`products`)

### Setor (PDV) (`setores`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Agrupamento de produtos no PDV (e se aparece na cozinha).

### Grupo (PDV) (`grupos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Grupo de produtos dentro de um setor.

### Grupo de adicionais (PDV) (`grupos_complemento`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local do grupo de adicionais.
- **Espelho no PDV/nuvem:** Grupo de adicionais (`complement_groups`)

### Opção de adicional (PDV) (`opcoes_complemento`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local da opção, com o custo. Não guarda qual insumo está ligado.
- **Espelho no PDV/nuvem:** Opção de adicional (`complement_options`)

### Produto × grupo (PDV) (`produto_grupos_complemento`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local da ligação produto × grupo de adicionais.
- **Espelho no PDV/nuvem:** Produto × grupo de adicionais (`product_complement_groups`)

### Departamento de impressão (PDV) (`departamentos_impressao`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local do departamento.
- **Espelho no PDV/nuvem:** Departamento de impressão (`print_departments`)

### Produto × departamento (PDV) (`departamento_impressao_produtos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local da ligação.
- **Espelho no PDV/nuvem:** Produto × departamento (`product_print_departments`)

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Produto (PDV) | Produto | Mesmo código (uuid); o PDV baixa a cada ciclo. |
| Grupo de adicionais (PDV) | Grupo de adicionais | Baixado do cardápio público. |
| Opção de adicional (PDV) | Opção de adicional | Baixado do cardápio público; custo pela rota de custos. |
| Produto × grupo (PDV) | Produto × grupo de adicionais | Baixado do cardápio público. |
| Departamento de impressão (PDV) | Departamento de impressão | Baixado a cada ciclo. |

## Pendências e decisões

- Confirmar se Setor e Grupo do PDV correspondem a Categoria e Subcategoria da nuvem.
