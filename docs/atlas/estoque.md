# Estoque e compras

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/estoque.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Insumos, ficha técnica dos produtos, movimentos de estoque (entradas, saídas e a baixa das vendas), fornecedores com o De-Para da nota de entrada e a contagem de inventário. Decisão de 24/09: só o backend cria movimentos; o PDV manda fatos (venda, nota, contagem).

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
- **O que é:** Cada entrada e saída de produto ou insumo. A venda gera uma saída por insumo de cada item, apontando o item vendido (sale_item_id); o cancelamento com "Devolver ao Estoque" gera a entrada de volta. O saldo é a soma destes movimentos.
- **Quem grava:** A nuvem, ao receber a venda (o PDV não manda mais estoque desde o 2.4.16); entrada por nota fiscal; ajustes.
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
- Cancelamento depois da sincronia: o estoque segue a escolha do operador (decisão de 25/09, backend 2.6.89).
