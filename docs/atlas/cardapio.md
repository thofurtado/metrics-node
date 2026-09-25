# Cardápio e produtos

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/cardapio.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Produtos, categorias, grupos de adicionais e seus itens, e os departamentos de impressão (para onde cada produto vai na cozinha). A nuvem é a fonte: o PDV baixa o cardápio a cada ciclo.

## Produto · `products` (nuvem)

- **O que é:** Produto vendido, com preço, custo, dados fiscais (NCM, CFOP, CSOSN), estoque e se aparece no cardápio online.
- **Quem grava:** Web → Mercadorias & Cardápio; importador Metrics.Sync.
- **Quem lê:** Cardápio online, PDV (baixa a cada ciclo), estoque, custo e delivery.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `display_id` | Int (único) | sim |  |  |
| `price` | Float | sim |  |  |
| `stock` | Float | não |  |  |
| `min_stock` | Float | não |  |  |
| `barcode` | String | não |  |  |
| `ncm` | String | não |  |  |
| `cest` | String | não |  |  |
| `cfop` | String | não |  |  |
| `csosn` | String | não |  |  |
| `cst_icms` | String | não |  |  |
| `origem` | Int | não |  |  |
| `cst_pis` | String | não |  |  |
| `aliquota_pis` | Float | não |  |  |
| `cst_cofins` | String | não |  |  |
| `aliquota_cofins` | Float | não |  |  |
| `active` | Boolean | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `description` | String | não |  |  |
| `is_composite` | Boolean | sim |  |  |
| `is_priority` | Boolean | sim |  |  |
| `show_on_menu` | Boolean | sim |  |  |
| `name` | String | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `cost` | Float | não |  |  |
| `category_id` | String | não | Categoria (Cardápio e produtos) |  |
| `subcategory_id` | String | não | Subcategoria (Cardápio e produtos) |  |
| `measureUnit` | MeasureUnit | sim |  |  |
| `image_url` | String | não |  |  |

## Categoria · `categories` (nuvem)

- **O que é:** Categoria do cardápio.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String (único) | sim |  |  |

## Subcategoria · `subcategories` (nuvem)

- **O que é:** Subdivisão de uma categoria.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `category_id` | String | sim | Categoria (Cardápio e produtos) |  |
| `accepts_fractions` | Boolean | sim |  |  |
| `max_fractions` | Int | sim |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Grupo de adicionais · `complement_groups` (nuvem)

- **O que é:** Grupo de opções de um produto (ex.: "Adicionais", "Ponto da carne"), com mínimo, máximo e quantidade grátis.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `min_quantity` | Int | sim |  |  |
| `max_quantity` | Int | sim |  |  |
| `free_quantity` | Int | sim |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Opção de adicional · `complement_options` (nuvem)

- **O que é:** Cada opção do grupo, com preço e, se baixa estoque, o insumo e o consumo por porção.
- **Quem grava:** Web → aba Adicionais & Opcionais (campo Consumo por porção desde a web 2.6.20.3).
- **Atenção:** linked_supply_id e linked_product_id não são chaves no banco.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `group_id` | String | sim | Grupo de adicionais (Cardápio e produtos) |  |
| `name` | String | sim |  |  |
| `price` | Float | sim |  |  |
| `linked_product_id` | String | não |  |  |
| `linked_supply_id` | String | não |  |  |
| `supply_quantity` | Float | não |  | (consumo por porção) |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Produto × grupo de adicionais · `product_complement_groups` (nuvem)

- **O que é:** Quais grupos de adicionais cada produto oferece, e em que ordem.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `product_id` | String | sim | Produto (Cardápio e produtos) |  |
| `group_id` | String | sim | Grupo de adicionais (Cardápio e produtos) |  |
| `order` | Int | sim |  |  |

## Departamento de impressão · `print_departments` (nuvem)

- **O que é:** Setor da cozinha que recebe o pedido impresso (ex.: bar, chapa).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String (único) | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Produto × departamento · `product_print_departments` (nuvem)

- **O que é:** Para quais departamentos cada produto é impresso.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `product_id` | String | sim | Produto (Cardápio e produtos) |  |
| `print_department_id` | String | sim | Departamento de impressão (Cardápio e produtos) |  |
| `created_at` | DateTime | sim |  |  |

## Produto (PDV) · `produtos` (PDV)

- **O que é:** Cópia local do produto, baixada da nuvem, com o custo recebido pela rota de custos.
- **Espelho:** Produto

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `display_id` | int | sim |  |  |
| `setor_id` | int | sim | Setor (PDV) (Cardápio e produtos) |  |
| `grupo_id` | int | não | Grupo (PDV) (Cardápio e produtos) |  |
| `nome` | string | sim |  |  |
| `preco` | decimal | sim |  |  |
| `preco_custo` | decimal | sim |  |  |
| `codigo_barras` | string | não |  |  |
| `ativo` | bool | sim |  |  |
| `gerencia_estoque` | bool | sim |  |  |
| `estoque_atual` | decimal | sim |  |  |
| `imagem_path` | string | não |  |  |
| `is_composite` | bool | sim |  |  |
| `subcategoria_nome` | string | não |  |  |
| `aceita_fracionamento` | bool | sim |  |  |
| `max_fracoes` | int | sim |  |  |
| `is_prioridade_kds` | bool | sim |  |  |
| `ncm` | string | não |  |  |
| `cest` | string | não |  |  |
| `cfop` | string | não |  |  |
| `csosn` | string | não |  |  |
| `cst_icms` | string | não |  |  |
| `origem` | int | sim |  |  |
| `cst_pis` | string | não |  |  |
| `aliquota_pis` | decimal | não |  |  |
| `cst_cofins` | string | não |  |  |
| `aliquota_cofins` | decimal | não |  |  |
| `aliquota_ibs` | decimal | não |  |  |
| `aliquota_cbs` | decimal | não |  |  |

## Setor (PDV) · `setores` (PDV)

- **O que é:** Agrupamento de produtos no PDV (e se aparece na cozinha).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `ativo` | bool | sim |  |  |
| `exibe_no_kdv` | bool | sim |  |  |

## Grupo (PDV) · `grupos` (PDV)

- **O que é:** Grupo de produtos dentro de um setor.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `setor_id` | int | sim | Setor (PDV) (Cardápio e produtos) |  |
| `nome` | string | sim |  |  |
| `ativo` | bool | sim |  |  |

## Grupo de adicionais (PDV) · `grupos_complemento` (PDV)

- **O que é:** Cópia local do grupo de adicionais.
- **Espelho:** Grupo de adicionais

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `min_quantidade` | int | sim |  |  |
| `max_quantidade` | int | sim |  |  |
| `free_quantidade` | int | sim |  |  |
| `ativo` | bool | sim |  |  |

## Opção de adicional (PDV) · `opcoes_complemento` (PDV)

- **O que é:** Cópia local da opção, com o custo. Não guarda qual insumo está ligado.
- **Espelho:** Opção de adicional

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `grupo_complemento_id` | int | sim |  |  |
| `nome` | string | sim |  |  |
| `preco` | decimal | sim |  |  |
| `custo` | decimal | sim |  |  |
| `ativo` | bool | sim |  |  |

## Produto × grupo (PDV) · `produto_grupos_complemento` (PDV)

- **O que é:** Cópia local da ligação produto × grupo de adicionais.
- **Espelho:** Produto × grupo de adicionais

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `produto_id` | int | sim | Produto (PDV) (Cardápio e produtos) |  |
| `grupo_complemento_id` | int | sim | Grupo de adicionais (PDV) (Cardápio e produtos) |  |
| `ordem` | int | sim |  |  |

## Departamento de impressão (PDV) · `departamentos_impressao` (PDV)

- **O que é:** Cópia local do departamento.
- **Espelho:** Departamento de impressão

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `uuid` | Guid (chave) | sim |  |  |
| `nome` | string | sim |  |  |

## Produto × departamento (PDV) · `departamento_impressao_produtos` (PDV)

- **O que é:** Cópia local da ligação.
- **Espelho:** Produto × departamento

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `departamento_uuid` | Guid | sim | Departamento de impressão (PDV) (Cardápio e produtos) |  |
| `produto_uuid` | Guid | sim |  |  |

## Ligações sem chave e propostas

- Opção de adicional → Insumo: texto · linked_supply_id
- Opção de adicional → Produto: texto · linked_product_id
- Opção de adicional (PDV) → Grupo de adicionais (PDV): texto · grupo_complemento_id

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Produto (PDV) | Produto | Mesmo código (uuid); o PDV baixa a cada ciclo. |
| Grupo de adicionais (PDV) | Grupo de adicionais | Baixado do cardápio público. |
| Opção de adicional (PDV) | Opção de adicional | Baixado do cardápio público; custo pela rota de custos. |
| Produto × grupo (PDV) | Produto × grupo de adicionais | Baixado do cardápio público. |
| Departamento de impressão (PDV) | Departamento de impressão | Baixado a cada ciclo. |

## Ligações com outros módulos

- De-Para do fornecedor (Estoque e compras) `product_id` → Produto
- Ficha técnica (Estoque e compras) `product_id` → Produto
- Item contado (Estoque e compras) `product_id` → Produto
- Item da O.S. (Ordens de serviço) `product_id` → Produto
- Item da evasão (PDV) (Estoque e compras) `produto_id` → Produto (PDV)
- Item do pedido (PDV) (Caixa e vendas) `produto_id` → Produto (PDV)
- Item vendido (Caixa e vendas) `product_id` → Produto
- Movimento de estoque (Estoque e compras) `product_id` → Produto
- Movimento de estoque (PDV) (Estoque e compras) `produto_id` → Produto (PDV)
- Vínculo com delivery (Delivery e pedidos online) `product_id` → Produto

## Pendências e decisões

- Confirmar se Setor e Grupo do PDV correspondem a Categoria e Subcategoria da nuvem.
