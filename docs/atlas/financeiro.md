# Financeiro

> Gerado por `atlas.py` em 10/10/2026 a partir do código e de `modulos/financeiro.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Contas (inclusive o Caixa Central), lançamentos a pagar e a receber, cartão de crédito com fatura, transferências, setores (centros de custo), formas e condições de pagamento e maquininhas com taxas. A conferência do caixa gera os lançamentos daqui.

## Regras de Negócio e Porquês

### Clientes a Prazo mostra e dá baixa na conta do cliente (fiado do PDV) (`regra-clientes-a-prazo-le-a-conta`)
- **Regra:** A lista Clientes a Prazo traz, junto com as receitas a prazo e os vales, as contas abertas dos clientes (id "tab-...", com o nome do cliente). A baixa quita a conta: inteira (receita confirmada na conta escolhida, "Acerto A Prazo - cliente - ..."), parcial (a conta vira paga com o valor recebido e o saldo fica numa conta aberta da mesma venda) ou por permuta (quita sem dinheiro). O painel soma as contas abertas no a receber do mês (vencimento 30 dias depois da venda) e no a receber vencido.
- **Por que é assim:** Decisão do Thomás de 25/09/2026: o financeiro lê o total a receber das contas dos clientes. Antes a tela não via as contas e a baixa não chegava ao saldo que o PDV mostra.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/financial/services/conta-do-cliente.ts`, `metrics-node/src/modules/financial/http/controllers/settlements.ts`, `metrics-node/src/modules/financial/http/controllers/settle-term-debt.ts`, `metrics-node/src/modules/financial/repositories/prisma/prisma-transactions-repository.ts`, `metrics-node/src/modules/financial/http/controllers/get-operational-summary.ts`

## Trabalhos que rodam o tempo todo

### Formas de pagamento, identificadores, maquininhas e condições (PDV) — Atenção
- **Frequência:** a cada 5 min (sincronia geral do PDV) (4 chamadas)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /payments, /payment-identifiers, /pos-machines, /payment-conditions`
- **Quantos:** 1 por loja
- **A cada vez:** 4 listas pequenas, sempre inteiras.
- **Por que existe:** Formas de pagamento e maquininhas cadastradas na web aparecem no PDV.
- **Proposta:** 30-60 min ou carimbo de mudança.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:875`

## Tabelas e Estrutura de Dados

### Lançamento financeiro (`transactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Receita ou despesa, com vencimento, conta, setor, fornecedor, parcelamento e, quando vem da conferência, o caixa de origem.
- **Quem grava:** Web (financeiro), conferência de caixa, ordens de serviço, faturas do cartão.

### Conta (`accounts`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Conta bancária ou de caixa (inclusive o Caixa Central, que recebe o dinheiro conferido).

### Cartão de crédito (`credit_cards`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cartão da empresa, com limite, fechamento e vencimento da fatura.

### Ajuste de saldo (`account_adjustments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Correção manual do saldo de uma conta.

### Parcelamento / recorrência (`transaction_groups`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Agrupa os lançamentos de uma compra parcelada ou recorrente (quantidade de parcelas e frequência).

### Transferência (`transfer_transactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga o lançamento de saída e o de entrada de uma transferência entre contas.

### Setor (centro de custo) (`sectors`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Classificação de despesas e receitas.

### Forma de pagamento (`payments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Dinheiro, Pix, cartões, a prazo…, com limite de parcelas e conta de destino.
- **Espelho no PDV/nuvem:** Forma de pagamento (PDV) (`formas_pagamento`)

### Parcela (`installment_payments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga a forma de pagamento ao lançamento de cada parcela.

### Identificador (`payment_identifiers`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Subtipo de uma forma de pagamento; pode marcar dívida de correntista ou evasão de estoque.
- **Espelho no PDV/nuvem:** Identificador (PDV) (`identificadores`)

### Condição de pagamento (`payment_conditions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Número de parcelas aceito.
- **Espelho no PDV/nuvem:** Condição (PDV) (`condicoes_pagamento`)

### Maquininha (`pos_machines`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Maquininha de cartão.
- **Espelho no PDV/nuvem:** Maquininha (PDV) (`maquininhas`)

### Taxa da maquininha (`pos_machine_rates`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Taxa e prazo de recebimento por forma e parcelas.
- **Espelho no PDV/nuvem:** Taxa da maquininha (PDV) (`maquininha_taxas`)

### Banco (PDV) (`bancos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Conta de destino da forma de pagamento no PDV.

### Forma de pagamento (PDV) (`formas_pagamento`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local, com a categoria que decide o troco (só Dinheiro dá troco).
- **Espelho no PDV/nuvem:** Forma de pagamento (`payments`)

### Condição (PDV) (`condicoes_pagamento`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local.
- **Espelho no PDV/nuvem:** Condição de pagamento (`payment_conditions`)

### Identificador (PDV) (`identificadores`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local.
- **Espelho no PDV/nuvem:** Identificador (`payment_identifiers`)

### Maquininha (PDV) (`maquininhas`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local.
- **Espelho no PDV/nuvem:** Maquininha (`pos_machines`)

### Taxa da maquininha (PDV) (`maquininha_taxas`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local.
- **Espelho no PDV/nuvem:** Taxa da maquininha (`pos_machine_rates`)

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Forma de pagamento (PDV) | Forma de pagamento | Baixado a cada ciclo. |
| Condição (PDV) | Condição de pagamento | Baixado a cada ciclo. |
| Identificador (PDV) | Identificador | Baixado a cada ciclo. |
| Maquininha (PDV) | Maquininha | Baixado a cada ciclo. |
| Taxa da maquininha (PDV) | Taxa da maquininha | Baixado a cada ciclo. |

## Pendências e decisões

- Desfazer a baixa (Recebidos > reverter) de um acerto de conta do cliente não reabre a conta: a receita volta a pendente sozinha (10/10/2026).
