# Ordens de serviço

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/servicos.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Atendimento técnico: a ordem de serviço de um equipamento do cliente, os itens e serviços usados, o andamento e o pagamento.

## Ordem de serviço · `treatments` (nuvem)

- **O que é:** Atendimento técnico de um cliente, ligado a um equipamento e a um responsável.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `opening_date` | DateTime | sim |  |  |
| `ending_date` | DateTime | não |  |  |
| `contact` | String | não |  |  |
| `user_id` | String | não | Usuário (Empresa, usuários e configuração) |  |
| `client_id` | String | não | Cliente (Clientes) |  |
| `equipment_id` | String | não | Equipamento (Ordens de serviço) |  |
| `request` | String | sim |  |  |
| `status` | String | sim |  |  |
| `observations` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Item da O.S. · `treatment_items` (nuvem)

- **O que é:** Produto, insumo ou serviço usado na ordem de serviço (baixa estoque).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `treatment_id` | String | sim | Ordem de serviço (Ordens de serviço) |  |
| `stock_id` | String | não | Movimento de estoque (Estoque e compras) |  |
| `quantity` | Float | sim |  |  |
| `salesValue` | Float | não |  |  |
| `discount` | Float | não |  |  |
| `observations` | String | não |  |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `service_id` | String | não | Serviço (Ordens de serviço) |  |
| `supply_id` | String | não | Insumo (Estoque e compras) |  |

## Serviço · `services` (nuvem)

- **O que é:** Serviço cobrado (mão de obra).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `display_id` | Int (único) | sim |  |  |
| `price` | Float | sim |  |  |
| `estimated_time` | String | não |  |  |
| `active` | Boolean | não |  |  |
| `category` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `description` | String | não |  |  |
| `name` | String | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Equipamento · `equipments` (nuvem)

- **O que é:** Equipamento do cliente atendido.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `client_id` | String | não | Cliente (Clientes) |  |
| `type` | String | sim |  |  |
| `brand` | String | não |  |  |
| `identification` | String | não |  |  |
| `details` | String | não |  |  |
| `entry` | DateTime | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `last_telemetry` | Json | não |  |  |
| `is_online` | Boolean | sim |  |  |
| `last_seen_at` | DateTime | não |  |  |

## Andamento · `interactions` (nuvem)

- **O que é:** Registro do andamento da ordem de serviço, por usuário.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `user_id` | String | sim | Usuário (Empresa, usuários e configuração) |  |
| `treatment_id` | String | sim | Ordem de serviço (Ordens de serviço) |  |
| `date` | DateTime | sim |  |  |
| `description` | String | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## O.S. × lançamento · `treatment_transactions` (nuvem)

- **O que é:** Liga a ordem de serviço aos lançamentos financeiros que ela gerou.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `treatment_id` | String | sim | Ordem de serviço (Ordens de serviço) |  |
| `transaction_id` | String | sim | Lançamento financeiro (Financeiro) |  |
| `created_at` | DateTime | sim |  |  |

## Pagamento da O.S. · `payment_entries` (nuvem)

- **O que é:** Forma de pagamento, parcelas e valor pagos na ordem de serviço.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `payment_id` | String | sim | Forma de pagamento (Financeiro) |  |
| `treatment_id` | String | sim | Ordem de serviço (Ordens de serviço) |  |
| `occurrences` | Int | sim |  |  |
| `amount` | Float | sim |  |  |

## Ligações com outros módulos

- Andamento `user_id` → Usuário (Empresa, usuários e configuração)
- Equipamento `client_id` → Cliente (Clientes)
- Item da O.S. `product_id` → Produto (Cardápio e produtos)
- Item da O.S. `stock_id` → Movimento de estoque (Estoque e compras)
- Item da O.S. `supply_id` → Insumo (Estoque e compras)
- O.S. × lançamento `transaction_id` → Lançamento financeiro (Financeiro)
- Ordem de serviço `client_id` → Cliente (Clientes)
- Ordem de serviço `user_id` → Usuário (Empresa, usuários e configuração)
- Pagamento da O.S. `payment_id` → Forma de pagamento (Financeiro)
- Ficha técnica (Estoque e compras) `service_id` → Serviço
- Item vendido (Caixa e vendas) `service_id` → Serviço
- Lançamento financeiro (Financeiro) `treatment_id` → Ordem de serviço
- Venda (Caixa e vendas) `treatment_id` → Ordem de serviço

## Pendências e decisões

- Descrições tiradas dos nomes e das ligações: confirmar com quem usa o módulo.
