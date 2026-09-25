# Estoque e compras

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/estoque.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Insumos, ficha técnica dos produtos, movimentos de estoque (entradas, saídas e a baixa das vendas), fornecedores com o De-Para da nota de entrada e a contagem de inventário. Decisão de 24/09: só o backend cria movimentos; o PDV manda fatos (venda, nota, contagem).

## Insumo · `supplies` (nuvem)

- **O que é:** Matéria-prima com custo, unidade e saldo (bacon em kg, caixa de pizza em unidade).
- **Quem lê:** Ficha técnica, custo e baixa das vendas.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `cost` | Float | sim |  |  |
| `stock` | Float | não |  |  |
| `unit` | String | não |  |  |
| `active` | Boolean | não |  |  |
| `category` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `description` | String | não |  |  |
| `name` | String | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Ficha técnica · `compositions` (nuvem)

- **O que é:** Quanto de cada insumo vai em um produto composto (ou em um serviço).
- **Quem lê:** Custo do produto e baixa de estoque da venda.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `supply_id` | String | sim | Insumo (Estoque e compras) |  |
| `quantity` | Float | sim |  |  |
| `service_id` | String | não | Serviço (Ordens de serviço) |  |

## Movimento de estoque · `stocks` (nuvem)

- **O que é:** Cada entrada e saída de produto ou insumo. A venda gera uma saída por insumo de cada item, apontando o item vendido (sale_item_id); o cancelamento com "Devolver ao Estoque" gera a entrada de volta. O saldo é a soma destes movimentos.
- **Quem grava:** A nuvem, ao receber a venda (o PDV não manda mais estoque desde o 2.4.16); entrada por nota fiscal; ajustes.
- **Cresce:** ~1.800 por dia num restaurante de 200 vendas com fichas de 3 insumos (~650 mil por ano). A maior tabela.
- **Atenção:** Baixas gravadas antes do backend 2.6.89 não apontam o item vendido.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `quantity` | Float | sim |  |  |
| `operation` | StockOperation | sim |  |  |
| `description` | StockReason | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `supply_id` | String | não | Insumo (Estoque e compras) |  |
| `unit_cost` | Float | não |  |  |
| `sale_item_id` | String | não | Item vendido (Caixa e vendas) | Item vendido que gerou esta baixa (estorno do cancelamento e conferência dependem disso) |
| `batch_number` | String | não |  |  |
| `expiration_date` | DateTime | não |  |  |
| `supplier_cnpj` | String | não |  |  |

## Fornecedor · `suppliers` (nuvem)

- **O que é:** Fornecedor das notas de entrada e das despesas.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `document` | String | não |  |  |
| `email` | String | não |  |  |
| `phone` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## De-Para do fornecedor · `supplier_product_mappings` (nuvem)

- **O que é:** Liga o item da nota do fornecedor ao insumo ou produto do Metrics, com fator de conversão da embalagem.
- **Quem grava:** Entrada de nota fiscal (XML do fornecedor).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `supplier_cnpj` | String | sim |  |  |
| `supplier_name` | String | não |  |  |
| `supplier_product_code` | String | sim |  |  |
| `supplier_product_name` | String | sim |  |  |
| `supplier_unit` | String | sim |  |  |
| `supply_id` | String | não | Insumo (Estoque e compras) |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `conversion_factor` | Float | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Contagem de inventário · `inventory_sessions` (nuvem)

- **O que é:** Uma contagem de estoque (pode ser cega), por setor.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `user_id` | String | não |  |  |
| `status` | String | sim |  |  |
| `sector` | String | não |  |  |
| `blind_count` | Boolean | sim |  |  |
| `notes` | String | não |  |  |
| `opened_at` | DateTime | sim |  |  |
| `closed_at` | DateTime | não |  |  |

## Item contado · `inventory_items` (nuvem)

- **O que é:** Quantidade contada de cada insumo ou produto numa contagem.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `inventory_session_id` | String | sim | Contagem de inventário (Estoque e compras) |  |
| `supply_id` | String | não | Insumo (Estoque e compras) |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `system_quantity` | Float | sim |  |  |
| `counted_quantity` | Float | sim |  |  |
| `unit_cost` | Float | sim |  |  |
| `difference_quantity` | Float | sim |  |  |
| `total_difference_cost` | Float | sim |  |  |

## Movimento de estoque (PDV) · `movimentacoes_estoque` (PDV)

- **O que é:** Movimentos gravados pelo PDV (estorno e desperdício no cancelamento, evasão).
- **Atenção:** Não sobe mais para a nuvem (decisão de 24/09: estoque só pelo backend).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `produto_id` | int | sim | Produto (PDV) (Cardápio e produtos) |  |
| `quantidade` | decimal | sim |  |  |
| `operacao` | string | sim |  |  |
| `motivo` | string | sim |  |  |
| `data_hora` | DateTime | sim |  |  |
| `sincronizado_web` | bool | sim |  |  |

## Evasão de estoque (PDV) · `evasoes_estoque` (PDV)

- **O que é:** Saída de mercadoria sem venda, classificada por um identificador (ex.: consumo interno, cortesia).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `identificador_id` | int | não | Identificador (PDV) (Financeiro) |  |
| `data_evasao` | DateTime | sim |  |  |
| `usuario_id` | Guid | não | Usuário (PDV) (Empresa, usuários e configuração) |  |
| `observacao` | string | não |  |  |

## Item da evasão (PDV) · `evasoes_estoque_itens` (PDV)

- **O que é:** Produtos e quantidades de cada evasão.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `evasao_id` | int | sim | Evasão de estoque (PDV) (Estoque e compras) |  |
| `produto_id` | int | sim | Produto (PDV) (Cardápio e produtos) |  |
| `quantidade` | decimal | sim |  |  |
| `custo_unitario` | decimal | sim |  |  |

## Ligações com outros módulos

- De-Para do fornecedor `product_id` → Produto (Cardápio e produtos)
- Evasão de estoque (PDV) `identificador_id` → Identificador (PDV) (Financeiro)
- Evasão de estoque (PDV) `usuario_id` → Usuário (PDV) (Empresa, usuários e configuração)
- Ficha técnica `product_id` → Produto (Cardápio e produtos)
- Ficha técnica `service_id` → Serviço (Ordens de serviço)
- Item contado `product_id` → Produto (Cardápio e produtos)
- Item da evasão (PDV) `produto_id` → Produto (PDV) (Cardápio e produtos)
- Movimento de estoque `product_id` → Produto (Cardápio e produtos)
- Movimento de estoque `sale_item_id` → Item vendido (Caixa e vendas)
- Movimento de estoque (PDV) `produto_id` → Produto (PDV) (Cardápio e produtos)
- Item da O.S. (Ordens de serviço) `stock_id` → Movimento de estoque
- Item da O.S. (Ordens de serviço) `supply_id` → Insumo
- Item vendido (Caixa e vendas) `supply_id` → Insumo
- Lançamento financeiro (Financeiro) `supplier_id` → Fornecedor

## Pendências e decisões

- Custo médio (CMP) na entrada de nota ainda substitui o custo em vez de fazer a média ponderada.
- Cancelamento depois da sincronia: o estoque segue a escolha do operador (decisão de 25/09, backend 2.6.89).
