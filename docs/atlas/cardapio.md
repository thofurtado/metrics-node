# Cardápio e produtos

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/cardapio.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Produtos, categorias, grupos de adicionais e seus itens, e os departamentos de impressão (para onde cada produto vai na cozinha). A nuvem é a fonte: o PDV baixa o cardápio a cada ciclo.

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
