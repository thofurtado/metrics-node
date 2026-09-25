# Financeiro

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/financeiro.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Contas (inclusive o Caixa Central), lançamentos a pagar e a receber, cartão de crédito com fatura, transferências, setores (centros de custo), formas e condições de pagamento e maquininhas com taxas. A conferência do caixa gera os lançamentos daqui.

## Lançamento financeiro · `transactions` (nuvem)

- **O que é:** Receita ou despesa, com vencimento, conta, setor, fornecedor, parcelamento e, quando vem da conferência, o caixa de origem.
- **Quem grava:** Web (financeiro), conferência de caixa, ordens de serviço, faturas do cartão.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `operation` | String | sim |  |  |
| `data_vencimento` | DateTime | sim |  |  |
| `amount` | Float | sim |  |  |
| `account_id` | String | não | Conta (Financeiro) |  |
| `sector_id` | String | não | Setor (centro de custo) (Financeiro) |  |
| `description` | String | não |  |  |
| `confirmed` | Boolean | sim |  |  |
| `checked` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `parent_transaction_id` | String | não | Lançamento financeiro (Financeiro) |  |
| `supplier_id` | String | não | Fornecedor (Estoque e compras) |  |
| `transaction_group_id` | String | não | Parcelamento / recorrência (Financeiro) |  |
| `cashier_session_id` | String | não | Caixa (Caixa e vendas) |  |
| `discount` | Float | não |  |  |
| `interest` | Float | não |  |  |
| `fine` | Float | não |  |  |
| `totalValue` | Float | não |  |  |
| `data_emissao` | DateTime | sim |  |  |
| `payment_method` | String | sim |  |  |
| `attachment_url` | String | não |  |  |
| `credit_card_id` | String | não | Cartão de crédito (Financeiro) |  |
| `treatment_id` | String | não | Ordem de serviço (Ordens de serviço) |  |

## Conta · `accounts` (nuvem)

- **O que é:** Conta bancária ou de caixa (inclusive o Caixa Central, que recebe o dinheiro conferido).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `description` | String | não |  |  |
| `balance` | Float | sim |  |  |
| `goal` | Float | não |  |  |
| `is_transit` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Cartão de crédito · `credit_cards` (nuvem)

- **O que é:** Cartão da empresa, com limite, fechamento e vencimento da fatura.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `bank` | String | sim |  |  |
| `credit_limit` | Float | sim |  |  |
| `closing_day` | Int | sim |  |  |
| `due_day` | Int | sim |  |  |
| `last_four_digits` | String | não |  |  |
| `color` | String | não |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `account_id` | String | não | Conta (Financeiro) |  |

## Ajuste de saldo · `account_adjustments` (nuvem)

- **O que é:** Correção manual do saldo de uma conta.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `account_id` | String | sim | Conta (Financeiro) |  |
| `previous_balance` | Float | sim |  |  |
| `new_balance` | Float | sim |  |  |
| `description` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |

## Parcelamento / recorrência · `transaction_groups` (nuvem)

- **O que é:** Agrupa os lançamentos de uma compra parcelada ou recorrente (quantidade de parcelas e frequência).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `totalAmount` | Float | sim |  |  |
| `installmentsCount` | Int | sim |  |  |
| `description` | String | não |  |  |
| `frequency` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |

## Transferência · `transfer_transactions` (nuvem)

- **O que é:** Liga o lançamento de saída e o de entrada de uma transferência entre contas.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `source_transaction_id` | String (único) | sim | Lançamento financeiro (Financeiro) |  |
| `dest_transaction_id` | String (único) | sim | Lançamento financeiro (Financeiro) |  |
| `fee_amount` | Float | sim |  |  |
| `description` | String | não |  |  |
| `is_automated` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |

## Setor (centro de custo) · `sectors` (nuvem)

- **O que é:** Classificação de despesas e receitas.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `budget` | Float | não |  |  |
| `type` | String | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Forma de pagamento · `payments` (nuvem)

- **O que é:** Dinheiro, Pix, cartões, a prazo…, com limite de parcelas e conta de destino.
- **Espelho:** Forma de pagamento (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `installment_limit` | Int | sim |  |  |
| `in_sight` | Boolean | sim |  |  |
| `account_id` | String | não | Conta (Financeiro) |  |
| `active` | Boolean | sim |  |  |
| `active_for_in` | Boolean | sim |  |  |
| `active_for_out` | Boolean | sim |  |  |
| `sefaz_tPag` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Parcela · `installment_payments` (nuvem)

- **O que é:** Liga a forma de pagamento ao lançamento de cada parcela.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `payment_id` | String | sim | Forma de pagamento (Financeiro) |  |
| `transaction_id` | String | sim | Lançamento financeiro (Financeiro) |  |
| `installment_number` | Int | sim |  |  |

## Identificador · `payment_identifiers` (nuvem)

- **O que é:** Subtipo de uma forma de pagamento; pode marcar dívida de correntista ou evasão de estoque.
- **Espelho:** Identificador (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String (único) | sim |  |  |
| `payment_method_id` | String | não | Forma de pagamento (Financeiro) |  |
| `is_correntista_debt` | Boolean | sim |  |  |
| `is_stock_evasion` | Boolean | sim |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Condição de pagamento · `payment_conditions` (nuvem)

- **O que é:** Número de parcelas aceito.
- **Espelho:** Condição (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String (único) | sim |  |  |
| `installments` | Int | sim |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Maquininha · `pos_machines` (nuvem)

- **O que é:** Maquininha de cartão.
- **Espelho:** Maquininha (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String (único) | sim |  |  |
| `account_id` | String | não |  |  |
| `active` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Taxa da maquininha · `pos_machine_rates` (nuvem)

- **O que é:** Taxa e prazo de recebimento por forma e parcelas.
- **Espelho:** Taxa da maquininha (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `pos_machine_id` | String | sim | Maquininha (Financeiro) |  |
| `payment_category` | String | sim |  |  |
| `installments` | Int | sim |  |  |
| `tax_percentage` | Float | sim |  |  |
| `advance_tax_percentage` | Float | sim |  |  |
| `settlement_days` | Int | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Banco (PDV) · `bancos` (PDV)

- **O que é:** Conta de destino da forma de pagamento no PDV.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `codigo_bancario` | string | não |  |  |
| `agencia` | string | não |  |  |
| `conta` | string | não |  |  |
| `ativo` | bool | sim |  |  |

## Forma de pagamento (PDV) · `formas_pagamento` (PDV)

- **O que é:** Cópia local, com a categoria que decide o troco (só Dinheiro dá troco).
- **Espelho:** Forma de pagamento

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `categoria` | CategoriaPagamento | sim |  |  |
| `taxa` | decimal | sim |  |  |
| `ativo` | bool | sim |  |  |
| `permite_parcelamento` | bool | sim |  |  |
| `sefaz_tpag` | string | não |  |  |
| `banco_id` | int | não | Banco (PDV) (Financeiro) |  |

## Condição (PDV) · `condicoes_pagamento` (PDV)

- **O que é:** Cópia local.
- **Espelho:** Condição de pagamento

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `qtd_parcelas` | int | sim |  |  |
| `ativo` | bool | sim |  |  |

## Identificador (PDV) · `identificadores` (PDV)

- **O que é:** Cópia local.
- **Espelho:** Identificador

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `tipo` | string | sim |  |  |
| `nome` | string | sim |  |  |
| `ativo` | bool | sim |  |  |

## Maquininha (PDV) · `maquininhas` (PDV)

- **O que é:** Cópia local.
- **Espelho:** Maquininha

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `nome` | string | sim |  |  |
| `ativo` | bool | sim |  |  |

## Taxa da maquininha (PDV) · `maquininha_taxas` (PDV)

- **O que é:** Cópia local.
- **Espelho:** Taxa da maquininha

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `maquininha_id` | int | sim | Maquininha (PDV) (Financeiro) |  |
| `forma_pagamento_id` | int | sim | Forma de pagamento (PDV) (Financeiro) |  |
| `parcelas` | int | sim |  |  |
| `taxa_percentual` | decimal | sim |  |  |

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Forma de pagamento (PDV) | Forma de pagamento | Baixado a cada ciclo. |
| Condição (PDV) | Condição de pagamento | Baixado a cada ciclo. |
| Identificador (PDV) | Identificador | Baixado a cada ciclo. |
| Maquininha (PDV) | Maquininha | Baixado a cada ciclo. |
| Taxa da maquininha (PDV) | Taxa da maquininha | Baixado a cada ciclo. |

## Ligações com outros módulos

- Lançamento financeiro `cashier_session_id` → Caixa (Caixa e vendas)
- Lançamento financeiro `supplier_id` → Fornecedor (Estoque e compras)
- Lançamento financeiro `treatment_id` → Ordem de serviço (Ordens de serviço)
- Evasão de estoque (PDV) (Estoque e compras) `identificador_id` → Identificador (PDV)
- Lançamento de folha (RH e ponto) `transaction_id` → Lançamento financeiro
- O.S. × lançamento (Ordens de serviço) `transaction_id` → Lançamento financeiro
- Pagamento (PDV) (Caixa e vendas) `condicao_pagamento_id` → Condição (PDV)
- Pagamento (PDV) (Caixa e vendas) `forma_pagamento_id` → Forma de pagamento (PDV)
- Pagamento (PDV) (Caixa e vendas) `identificador_id` → Identificador (PDV)
- Pagamento (PDV) (Caixa e vendas) `maquininha_id` → Maquininha (PDV)
- Pagamento da O.S. (Ordens de serviço) `payment_id` → Forma de pagamento

## Pendências e decisões

- A maquininha usada na venda do PDV não chega ao lançamento do caixa (sem taxa e sem banco na conferência).
