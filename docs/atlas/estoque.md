# Estoque e compras

> Gerado por `atlas.py` em 17/10/2026 a partir do código e de `modulos/estoque.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Insumos, ficha técnica dos produtos, movimentos de estoque (entradas, saídas e a baixa das vendas), fornecedores com o De-Para da nota de entrada e a contagem de inventário. Decisão de 24/09: só o backend cria movimentos; o PDV manda fatos (venda, nota, contagem).

## Regras de Negócio e Porquês

### Ficha técnica baixa os insumos; complemento baixa o insumo ligado; sem ficha baixa o próprio produto (`regra-baixa-pela-ficha-tecnica`)
- **Regra:** Ao receber a venda do PDV, cada item baixa: os insumos da ficha técnica (quantidade da ficha × quantidade vendida) se o produto é composto e tem ficha; senão o próprio produto. Cada complemento com insumo ligado baixa aquele insumo na quantidade cadastrada na opção × a quantidade escolhida × a vendida (a opção da nuvem manda; opção sem insumo não baixa). Pizza de vários sabores: cada sabor segue a mesma regra na sua fração. A quantidade vendida do produto vem dos itens da venda, não do estoque. A unidade é a que o insumo tem no cadastro.
- **Por que é assim:** Decisão D8: o estoque precisa refletir o que saiu da cozinha. Um produto montado (lanche) não tem estoque próprio: o que acaba são o pão, a carne e o queijo. Antes o sabor da pizza baixava insumos com qualquer linha de ficha e o produto inteiro só com a marca de composto (o mesmo produto baixava diferente).
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/stock/services/baixa-da-venda.ts`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`

### O saldo é da nuvem e nunca trava a venda (`regra-saldo-nunca-trava-venda`)
- **Regra:** A baixa pode deixar o saldo do produto ou do insumo negativo; o PDV vende do mesmo jeito. A Posição de Estoque mostra "Zerado ou negativo" e, para produto, "Abaixo do mínimo" só com o estoque mínimo do cadastro (nunca um mínimo inventado).
- **Por que é assim:** Decisão D5 (e a de 23/09/2026): o produto já está na mão do cliente e a nota tem que sair; quem compra vê o aviso depois, no back-office.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/stock/services/movimento-de-estoque.ts`, `metrics-node/src/modules/stock/services/posicao-do-estoque.ts`

### Todo movimento guarda quem fez e o saldo logo depois (`regra-movimento-guarda-quem-e-saldo`)
- **Regra:** Toda mudança de saldo passa por registrarMovimento: muda o cadastro e grava a linha de estoque com o usuário, o saldo logo depois, o texto e a nota de compra, na mesma transação. Saldo mudado no cadastro do produto ou do insumo vira um ajuste no histórico (a web não manda mais o saldo ao editar).
- **Por que é assim:** Decisão D6: o histórico precisa dizer "de 10 para 9, por fulano". Antes cada tela gravava do seu jeito e salvar o cadastro com a tela aberta havia horas regravava o saldo antigo, desfazendo as baixas das vendas sem rastro.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/stock/services/movimento-de-estoque.ts`, `metrics-node/src/modules/items/http/controllers/updateItem.ts`

### Histórico do produto nos dois lugares, com saldo antes e depois (`regra-historico-do-produto`)
- **Regra:** A mesma consulta na tabela de movimentos aparece no Controle de Estoque › Histórico (com filtro por produto, tipo e período) e na aba Histórico da ficha do produto (Mercadorias). Cada linha: data e hora, tipo (venda, compra/NF-e, perda, ajuste, estorno), quantidade, saldo antes → depois, quem fez e o toque que abre a venda ou a nota. Quem fez da venda = operador do caixa (e o vendedor do item). Saldo gravado manda; sem ele, calculado para trás a partir do saldo de hoje. Exporta CSV.
- **Por que é assim:** Decisão D6: "a amarração mais importante do sistema". Não cria tabela nova: a tabela de movimentos já tem uma linha por movimento (~300 mil por ano na Katatau, pouco com índice por produto e data).
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/stock/services/historico-do-estoque.ts`, `metrics-node/src/modules/stock/http/controllers/stock-history-controller.ts`, `metrics/src/pages/app/stock/components/historico-do-estoque.tsx`

### Estorno ligado à venda; desperdício aparece como perda (`regra-estorno-ligado-a-venda`)
- **Regra:** Cancelamento com "Devolver ao Estoque" devolve cada baixa do item como entrada "Estorno da venda #N" (número do PDV quando vem; senão os 8 primeiros caracteres), com quem cancelou e o cancelamento. "Registrar como Desperdício" mantém a saída, e o histórico mostra a baixa da venda cancelada como "Perda · venda cancelada". A escolha fica guardada no cancelamento (stock_destination): a venda cancelada que ainda não tinha subido só baixa o estoque se foi desperdício.
- **Por que é assim:** Decisão D12 e a de 28/09/2026 ("venda cancelada que não subiu: sem estorno na nuvem, só desperdício se escolhido"). Antes a escolha chegava e se perdia, e o desperdício da venda que não tinha subido não aparecia.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`

### A NF-e de compra entra uma vez, com o destino escolhido (`regra-nota-de-compra-uma-vez`)
- **Regra:** A mesma chave de NF-e não dá entrada duas vezes (409 com quando e quem). Todo item recebido precisa apontar para um produto ou insumo que existe (400 com os nomes). A quantidade conferida já vem na unidade do estoque; nota sem valor não zera o custo do cadastro. O porcionamento é opcional e vem desligado.
- **Por que é assim:** Decisão D5 (compras pela Entrada de Mercadorias). Antes a tela mandava o número com o nome errado (a nuvem recusava), um código inventado no item sem vínculo, convertia a quantidade duas vezes e mostrava "creditada" mesmo com a recusa; e quando a leitura falhava inventava uma nota de exemplo.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/stock/http/controllers/nfe-stock-controller.ts`, `metrics/src/pages/app/stock/stock-intake.tsx`

## Funções de Negócio

### `RegistrarMovimentoDeEstoque`
- **O que faz:** Muda o saldo do produto ou do insumo e grava a linha do movimento com quem fez e o saldo logo depois, numa transação.
- **Motivo de negócio:** Um lugar só para toda mudança de saldo: o histórico do produto fica completo e confiável.
- **Entradas:** alvo (produto ou insumo), entrada ou saída, quantidade, motivo, usuário, texto, nota de compra, saldo exato (ajuste)
- **Saídas:** linha em stocks, saldo depois
- **Usada por:** ['Nuvem: venda do PDV, cancelamento, NF-e, ajuste, inventário, Mercadorias']
- **Tabelas afetadas:** `nuvem:Stock`, `nuvem:Product`, `nuvem:Supply`

### `PlanejarBaixaDaVenda`
- **O que faz:** Diz o que um item vendido baixa: insumos da ficha, insumos dos complementos ou o próprio produto (regra D8).
- **Motivo de negócio:** Separar a regra (função pura, testada) da gravação, para a baixa ser igual em toda origem.
- **Entradas:** quantidade vendida, produto com a ficha, sabores e frações, complementos escolhidos
- **Saídas:** linhas de baixa (alvo, quantidade, custo)
- **Usada por:** ['Nuvem: sincronia de vendas do PDV']
- **Tabelas afetadas:** `nuvem:Composition`, `nuvem:ComplementOption`, `nuvem:Stock`

### `ConsultarHistoricoDoEstoque`
- **O que faz:** Lista os movimentos com tipo, saldo antes e depois, quem fez e a origem (venda ou nota), com filtro por produto, tipo, período e texto; a origem abre a venda ou a nota.
- **Motivo de negócio:** O extrato do Controle de Estoque e a aba Histórico da ficha do produto (D6).
- **Entradas:** período, tipo, produto ou insumo, texto, página
- **Saídas:** movimentos, totais de entrada e saída a custo, cabeçalho do item
- **Usada por:** ['Web: Controle de Estoque › Histórico', 'Web: Mercadorias › produto › Histórico']
- **Tabelas afetadas:** `nuvem:Stock`, `nuvem:SaleItem`, `nuvem:Sale`, `nuvem:CancellationAudit`, `nuvem:SupplierProductMapping`

## Trabalhos que rodam o tempo todo

### Posição de estoque na web — Ok
- **Frequência:** a cada 60 s com a aba visível (50 itens por página)
- **Onde roda:** Navegador, /stock aba 1 → `Nuvem: GET /api/stock/overview`
- **Quantos:** 1 por aba aberta
- **A cada vez:** Lê uma página de 50 itens (antes a lista inteira, 3 mil produtos na Katatau, a cada 30 s).
- **Por que existe:** Mostrar o saldo atualizado sem recarregar.
- **Onde no código:** `metrics/src/pages/app/stock/tabs/tab-stock-position.tsx`

## Tabelas e Estrutura de Dados

### Insumo (`supplies`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Matéria-prima com custo, unidade e saldo (bacon em kg, caixa de pizza em unidade).
- **Quem lê:** Ficha técnica, custo e baixa das vendas.

### Ficha técnica (`compositions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quanto de cada insumo vai em um produto composto (ou em um serviço).
- **Quem lê:** Custo do produto e baixa de estoque da venda.

### Movimento de estoque (`stocks`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada entrada e saída de produto ou insumo, uma linha por movimento (o histórico do produto é uma consulta nesta tabela, D6). A venda gera uma saída por insumo da ficha (ou do próprio produto sem ficha) de cada item, apontando o item vendido (sale_item_id); o cancelamento com "Devolver ao Estoque" gera a entrada "Estorno da venda #N" (cancellation_id). Desde 16/10/2026 cada linha guarda quem fez (user_id, user_name), o saldo logo depois (balance_after), o texto (note) e a NF-e de compra (document_key, document_number).
- **Quem grava:** Só a nuvem, sempre por registrarMovimento (stock/services/movimento-de-estoque.ts): a venda que sobe do PDV, o cancelamento, a perda mandada pelo PDV, a entrada de NF-e, o ajuste e o inventário da web, o movimento de Mercadorias e o saldo mudado no cadastro.
- **Cresce:** ~1.800 por dia num restaurante de 200 vendas com fichas de 3 insumos (~650 mil por ano). A maior tabela.

### Fornecedor (`suppliers`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Fornecedor das notas de entrada e das despesas.

### De-Para do fornecedor (`supplier_product_mappings`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga o item da nota do fornecedor ao insumo ou produto do Metrics, com fator de conversão da embalagem.
- **Quem grava:** Entrada de nota fiscal (XML do fornecedor).

### Contagem de inventário (`inventory_sessions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Uma contagem de estoque (pode ser cega), por setor.

### Item contado (`inventory_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quantidade contada de cada insumo ou produto numa contagem.

### Movimento de estoque (PDV) (`movimentacoes_estoque`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Movimentos gravados pelo PDV (estorno e desperdício no cancelamento, evasão).

### Evasão de estoque (PDV) (`evasoes_estoque`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Saída de mercadoria sem venda, classificada por um identificador (ex.: consumo interno, cortesia).

### Item da evasão (PDV) (`evasoes_estoque_itens`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Produtos e quantidades de cada evasão.

## Pendências e decisões

- Custo médio (CMP) na entrada de nota ainda substitui o custo em vez de fazer a média ponderada.
- Como medir os insumos (quilo, unidade, porção): a baixa usa a unidade que o insumo já tem; o porcionamento na entrada de nota é opcional e vem desligado (16/10/2026).
- Complemento ligado a um PRODUTO (não a um insumo) ainda não baixa estoque: a regra D8 só fala do insumo.
- O PDV não manda o operador de cada venda: o histórico mostra o operador do caixa e o vendedor do item.
- A nuvem não recebe o número da venda do PDV: o estorno usa o "Venda #N" do cancelamento e o resto, os 8 primeiros caracteres do código.
- O saldo regravado pelo sistema da loja (Sync, opção do estoque do sistema da loja) ainda não deixa linha no histórico.
- Venda cancelada que sobe ANTES do cancelamento (ordem inversa do ciclo do PDV) não registra o desperdício.
