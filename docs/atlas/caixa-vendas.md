# Caixa e vendas

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/caixa-vendas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

O caixa (aberto no PDV ou na web), os lançamentos que a Conferência de caixa soma por forma de pagamento, e a venda do PDV com itens e custo. Com o PDV, cada pagamento de uma venda vira um lançamento igual aos da web: a Conferência não muda de forma, e a venda fica ao lado, presa ao mesmo caixa.

## Caixa · `cashier_sessions` (nuvem)

- **O que é:** Cada caixa aberto, no PDV ou na web. No PDV tem o mesmo código do caixa local. Situação: aberto (OPEN), fechado esperando conferência (PENDING), conferido (CHECKED).
- **Quem grava:** A web ao abrir o caixa; o PDV ao abrir e ao fechar (desde o backend 2.6.87 o reenvio não reabre nem renumera, e caixa conferido não muda).
- **Quem lê:** Conferência de caixa e auditoria mensal.
- **Cresce:** 1 a 3 linhas por dia.
- **Espelho:** Caixa (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  | = caixa no PDV |
| `user_id` | String | sim |  | (operador) |
| `opened_at` | DateTime | sim |  |  |
| `closed_at` | DateTime | não |  |  |
| `status` | String | sim |  | OPEN→PENDING→CHECKED |
| `period` | String | sim |  |  |
| `sequence_number` | Int | sim |  |  |
| `initial_balance` | Float | sim |  | (fundo) |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `+ terminal_id` | proposta | | |  |
| `+ source` | proposta | | | PDV \| WEB |
| `+ counted` | proposta | | | (contado por forma) |
| `+ closing_difference` | proposta | | | (quebra) |

## Lançamento do caixa · `cashier_entries` (nuvem)

- **O que é:** Cada entrada ou saída do caixa: um por pagamento de venda e um por sangria, suprimento, despesa ou vale. É o que a Conferência soma por forma de pagamento.
- **Quem grava:** A web (lançamento manual e baixa de delivery) e o PDV (vendas e movimentos).
- **Quem lê:** Conferência de caixa.
- **Cresce:** ~230 por dia num restaurante de 200 vendas (1,1 por venda, mais os movimentos).
- **Espelho:** Movimento do caixa (PDV)
- **Atenção:** Hoje o lançamento só sabe de qual venda veio pelo texto "Balcao - Pedido #1f9408ee".

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `cashier_session_id` | String | sim | Caixa (Caixa e vendas) |  |
| `origin` | String | não |  |  |
| `bank` | String | não |  |  |
| `payment_method` | String | sim |  | (forma) |
| `amount` | Float | sim |  |  |
| `is_withdrawal` | Boolean | sim |  |  |
| `is_addition` | Boolean | sim |  |  |
| `is_tip` | Boolean | sim |  |  |
| `is_checked` | Boolean | sim |  |  |
| `type` | String | sim |  | SALE \| ADDITION \| … |
| `identification` | String | não |  | (texto) |
| `source` | String | sim |  |  |
| `client_id` | String | não | Cliente (Clientes) |  |
| `employee_id` | String | não | Funcionário (RH e ponto) |  |
| `sector_id` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `+ sale_id` | proposta | | | → Venda |

## Venda · `sales` (nuvem)

- **O que é:** Uma venda fechada no PDV: balcão, mesa ou salão. Tem o mesmo código do pedido no PDV. Guarda só total, desconto e situação.
- **Quem grava:** O PDV, na hora do pagamento e no ciclo de 5 minutos. A nuvem recusa com motivo venda sem caixa, de caixa desconhecido ou de caixa conferido.
- **Quem lê:** Custo da mercadoria vendida (CMV) e os relatórios que vão ser feitos.
- **Cresce:** 200 por dia (~73 mil por ano) no exemplo.
- **Espelho:** Pedido (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  | = pedido no PDV |
| `treatment_id` | String (único) | não | Ordem de serviço (Ordens de serviço) |  |
| `cashier_session_id` | String | não | Caixa (Caixa e vendas) |  |
| `total_amount` | Float | sim |  |  |
| `discount` | Float | não |  |  |
| `status` | String | sim |  | COMPLETED \| CANCELLED |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `+ origin` | proposta | | | Balcão, Mesa… |
| `+ origin_identifier` | proposta | | | Mesa 07 |
| `+ delivery_fee` | proposta | | |  |
| `+ service_fee` | proposta | | |  |
| `+ cover_charge` | proposta | | |  |

## Item vendido · `sale_items` (nuvem)

- **O que é:** Produto, quantidade, preço e o custo congelado na hora da venda, com o retrato de como o custo foi calculado.
- **Quem grava:** O PDV, junto com a venda. A baixa de estoque é feita pela nuvem ao gravar o item.
- **Quem lê:** Custo (CMV) e, no futuro, o relatório de produtos vendidos.
- **Cresce:** 600 por dia (~220 mil por ano) no exemplo. O retrato do custo (cost_snapshot) é o campo mais pesado.
- **Espelho:** Item do pedido (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  | = item no PDV |
| `sale_id` | String | sim | Venda (Caixa e vendas) |  |
| `product_id` | String | não | Produto (Cardápio e produtos) |  |
| `service_id` | String | não | Serviço (Ordens de serviço) |  |
| `supply_id` | String | não | Insumo (Estoque e compras) |  |
| `quantity` | Float | sim |  |  |
| `unit_price` | Float | sim |  |  |
| `discount` | Float | não |  |  |
| `unit_cost` | Float | não |  | Custo congelado no momento da venda (por unidade do item); ver modules/pdv-sync/services/item-cost.ts |
| `complements_cost` | Float | não |  |  |
| `cost_source` | String | não |  |  |
| `cost_snapshot` | Json | não |  |  |

## Fiado · `client_tabs` (nuvem)

- **O que é:** Conta a receber do cliente, criada quando a venda do PDV tem pagamento a prazo. Liga à venda só pelo texto.
- **Quem grava:** Só a sincronia do PDV. O fiado lançado na web vira receita a prazo, não esta conta.
- **Cresce:** Poucos por dia.
- **Atenção:** Depende da decisão sobre o fiado (pergunta 5 do documento de sincronia).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `client_id` | String | sim | Cliente (Clientes) |  |
| `amount` | Float | sim |  |  |
| `description` | String | não |  |  |
| `cashier_session_id` | String | não | Caixa (Caixa e vendas) |  |
| `is_paid` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Cancelamento · `cancellation_audits` (nuvem)

- **O que é:** Registro de cada item ou venda cancelada, com motivo, operador e origem. Aponta a venda pelo código, sem chave.
- **Quem grava:** O PDV, no ciclo de 5 minutos (voltou a subir no PDV 2.4.19.0).
- **Cresce:** Poucos por dia.
- **Espelho:** Item cancelado (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `sale_id` | String | não |  |  |
| `order_id` | String | não |  |  |
| `item_id` | String | não |  |  |
| `product_id` | String | não |  |  |
| `product_name` | String | sim |  |  |
| `quantity` | Float | sim |  |  |
| `unit_price` | Decimal | sim |  |  |
| `total_amount` | Decimal | sim |  |  |
| `origin` | String | sim |  | MESA, BALCAO, DELIVERY, VENDA_FISCAL |
| `origin_identifier` | String | não |  | Ex: Mesa 07, Comanda 12, Pedido #104 |
| `origin_uuid` | String | não |  |  |
| `cancellation_type` | String | sim |  | ITEM_AVULSO, MESA_COMPLETA, VENDA_TOTAL |
| `reason` | String | sim |  |  |
| `user_id` | String | não |  |  |
| `user_name` | String | não |  |  |
| `stock_restored` | Boolean | sim |  |  |
| `cancelled_at` | DateTime | sim |  |  |
| `created_at` | DateTime | sim |  |  |

## Caixa (PDV) · `caixas` (PDV)

- **O que é:** O caixa aberto neste terminal. Um aberto por terminal.
- **Quem grava:** CaixaView (abertura) e FechamentoCaixaView (fechamento).
- **Espelho:** Caixa

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  | = id na nuvem |
| `terminal_id` | string | sim |  |  |
| `data_abertura` | DateTime | sim |  |  |
| `data_fechamento` | DateTime | não |  |  |
| `valor_abertura` | decimal | sim |  |  |
| `valor_fechamento` | decimal | não |  |  |
| `status` | string | sim |  |  |
| `couvert_ativo` | bool | sim |  |  |
| `valor_couvert` | decimal | sim |  |  |
| `usuario_id` | Guid | não |  |  |
| `sincronizado_web` | bool | sim |  |  |

## Movimento do caixa (PDV) · `caixa_transacoes` (PDV)

- **O que é:** Sangria, suprimento, saída operacional, vale, sobra e quebra lançados no caixa do PDV.
- **Espelho:** Lançamento do caixa
- **Atenção:** Não guarda forma de pagamento, funcionário nem setor; a nuvem deduz o tipo pelo texto.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `sincronizado_web` | bool | sim |  |  |
| `caixa_id` | int | sim | Caixa (PDV) (Caixa e vendas) |  |
| `tipo` | string | sim |  |  |
| `valor` | decimal | sim |  |  |
| `data_transacao` | DateTime | sim |  |  |
| `observacao` | string | não |  |  |

## Pedido (PDV) · `pedidos` (PDV)

- **O que é:** A venda do PDV, de qualquer origem (balcão, mesa, delivery, iFood, 99Food), com NFC-e, controle de sincronia e totais.
- **Quem grava:** Caixa, Mesas, Delivery e o observador de pedidos online.
- **Cresce:** Um por venda ou pedido.
- **Espelho:** Venda
- **Atenção:** 42 colunas: totais, NFC-e, contingência, delivery e sincronia na mesma tabela.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `display_id` | int | sim |  |  |
| `numero_diario` | int | não |  |  |
| `origem` | string | sim |  |  |
| `atendimento_id` | int | não | Atendimento (mesa/comanda) (Mesas e salão) |  |
| `cliente_id` | int | não | Cliente (PDV) (Clientes) |  |
| `subtotal` | decimal | sim |  |  |
| `desconto_total` | decimal | sim |  |  |
| `valor_frete` | decimal | sim |  |  |
| `valor_servico` | decimal | sim |  |  |
| `valor_couvert` | decimal | sim |  |  |
| `total_tributos` | decimal | sim |  |  |
| `valor_final` | decimal | sim |  |  |
| `valor_troco` | decimal | sim |  |  |
| `data_abertura` | DateTime | sim |  |  |
| `data_fechamento` | DateTime | não |  |  |
| `status` | string | sim |  |  |
| `motivo_cancelamento` | string | não |  |  |
| `cpf_na_nota` | string | não |  |  |
| `status_delivery` | string | não |  |  |
| `endereco_entrega_id` | int | não | Endereço (PDV) (Clientes) |  |
| `entregador` | string | não |  |  |
| `observacao` | string | não |  |  |
| `hora_saida_rota` | DateTime | não |  |  |
| `caixa_id` | int | não | Caixa (PDV) (Caixa e vendas) |  |
| `usuario_id` | Guid | não | Usuário (PDV) (Empresa, usuários e configuração) |  |
| `chave_nfce` | string | não |  |  |
| `qrcode_nfce` | string | não |  |  |
| `is_contingencia` | bool | sim |  |  |
| `status_contingencia` | string | não |  |  |
| `xml_contingencia` | string | não |  |  |
| `data_envio_contingencia` | DateTime | não |  |  |
| `protocolo_nfce` | string | não |  |  |
| `status_nfce` | string | não |  |  |
| `sync_tentativas` | int | sim |  |  |
| `sync_ultimo_erro` | string | não |  |  |
| `sync_proxima_tentativa` | DateTime | não |  |  |
| `numero_nfce` | int | não |  |  |
| `ambiente_nfce` | string | não |  |  |
| `sincronizado_web` | bool | sim |  |  |
| `pagamento_alterado` | bool | sim |  |  |

## Item do pedido (PDV) · `pedido_itens` (PDV)

- **O que é:** Item lançado no pedido, com o custo congelado no momento do lançamento.
- **Espelho:** Item vendido

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `pedido_id` | int | sim | Pedido (PDV) (Caixa e vendas) |  |
| `produto_id` | int | sim | Produto (PDV) (Cardápio e produtos) |  |
| `custo_unitario` | decimal | não |  |  |
| `custo_complementos` | decimal | não |  |  |
| `custo_detalhe_json` | string | não |  |  |
| `complementos_json` | string | não |  |  |
| `status_cozinha` | string | sim |  |  |
| `hora_inicio_preparo` | DateTime | não |  |  |
| `hora_pronto` | DateTime | não |  |  |
| `data_lancamento` | DateTime | sim |  |  |

## Pagamento (PDV) · `pedido_pagamentos` (PDV)

- **O que é:** Cada pagamento do pedido: forma, maquininha, parcelas, cliente do fiado e colaborador.
- **Espelho:** Lançamento do caixa
- **Atenção:** O colaborador é um usuário do sistema, não um funcionário do RH (pergunta 4).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `pedido_id` | int | sim | Pedido (PDV) (Caixa e vendas) |  |
| `forma_pagamento_id` | int | sim | Forma de pagamento (PDV) (Financeiro) |  |
| `condicao_pagamento_id` | int | não | Condição (PDV) (Financeiro) |  |
| `maquininha_id` | int | não | Maquininha (PDV) (Financeiro) |  |
| `identificador_id` | int | não | Identificador (PDV) (Financeiro) |  |
| `valor_pago` | decimal | sim |  |  |
| `parcelas` | int | sim |  |  |
| `cliente_id` | int | não | Cliente (PDV) (Clientes) |  |
| `colaborador_id` | Guid | não | Usuário (PDV) (Empresa, usuários e configuração) |  |
| `nome_titular` | string | não |  |  |

## Item cancelado (PDV) · `itens_cancelados` (PDV)

- **O que é:** Registro de cancelamento de item ou venda, com destino do estoque escolhido pelo operador (estorno ou desperdício).
- **Espelho:** Cancelamento

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `pedido_id` | int | não |  |  |
| `pedido_uuid` | Guid | não |  |  |
| `pedido_item_id` | int | não |  |  |
| `pedido_item_uuid` | Guid | não |  |  |
| `produto_id` | int | não |  |  |
| `produto_nome` | string | sim |  |  |
| `quantidade` | decimal | sim |  |  |
| `valor_unitario` | decimal | sim |  |  |
| `valor_total` | decimal | sim |  |  |
| `origem` | string | sim |  |  |
| `origem_identificador` | string | não |  |  |
| `origem_uuid` | Guid | não |  |  |
| `tipo_cancelamento` | string | sim |  |  |
| `destino_estoque` | string | sim |  |  |
| `motivo` | string | sim |  |  |
| `usuario_id` | Guid | não |  |  |
| `usuario_nome` | string | não |  |  |
| `data_cancelamento` | DateTime | sim |  |  |
| `sincronizado_web` | bool | sim |  |  |

## Ligações sem chave e propostas

- Lançamento do caixa → Venda: proposta · + sale_id (hoje: texto)
- Movimento de estoque → Item vendido: proposta · + sale_item_id
- Cancelamento → Venda: texto · sale_id sem chave
- Pedido online → Venda: codigo · mesmo código: pedidos.uuid = sales.id
- Pedido online → Caixa: texto · caixa_id
- Lançamento de folha → Venda: texto
- Item cancelado (PDV) → Pedido (PDV): texto · pedido_id

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Caixa (PDV) | Caixa | Mesmo código (uuid do PDV = id na nuvem). |
| Movimento do caixa (PDV) | Lançamento do caixa | Mesmo código. |
| Pedido (PDV) | Venda | Mesmo código, quando fecha. Delivery hoje não vira venda (paliativo). |
| Item do pedido (PDV) | Item vendido | Mesmo código. |
| Pagamento (PDV) | Lançamento do caixa | Um lançamento por pagamento; hoje ligado pelo texto, proposta sale_id. |
| Item cancelado (PDV) | Cancelamento | Mesmo código. |

## Uma venda de mesa, do começo ao fim

| Momento | No PDV (banco local) | Na nuvem |
|---|---|---|
| Abrir a mesa e lançar itens | atendimentos, pedidos (Aberto) e pedido_itens | Mesa aberta e item na mesa, como foto, a cada 5 minutos |
| Transferir um item | O item muda de pedido e ganha uma linha em log_transferencias | Só a foto muda. A transferência não sobe. |
| Fechar a conta e pagar | O pedido vira Fechado e ganha pedido_pagamentos | Venda, itens vendidos, um lançamento por pagamento e as baixas de estoque. Fiado vira conta do cliente; consumo de funcionário vira vale. A mesa sai da foto. |
| Cancelar a venda | O pedido vira Cancelado e ganha itens_cancelados | A venda vira CANCELLED, os lançamentos dela são apagados e o cancelamento fica registrado. O estoque não volta (pergunta 9). Caixa conferido não é mexido. |
| Sangria, suprimento, despesa ou vale | caixa_transacoes | Um lançamento do caixa, com o mesmo código |
| Fechar o caixa | O caixa vira Fechado | O caixa vira PENDING. Depois a Conferência marca CHECKED. |
| Delivery baixado no PDV | O pedido vira Fechado e ganha pagamentos | Hoje: muda o status do pedido e às vezes sobe como venda. Pela decisão R2: sobe como venda do caixa que deu a baixa, uma vez só na Conferência. |

## Ligações com outros módulos

- Fiado `client_id` → Cliente (Clientes)
- Item do pedido (PDV) `produto_id` → Produto (PDV) (Cardápio e produtos)
- Item vendido `product_id` → Produto (Cardápio e produtos)
- Item vendido `service_id` → Serviço (Ordens de serviço)
- Item vendido `supply_id` → Insumo (Estoque e compras)
- Lançamento do caixa `client_id` → Cliente (Clientes)
- Lançamento do caixa `employee_id` → Funcionário (RH e ponto)
- Pagamento (PDV) `cliente_id` → Cliente (PDV) (Clientes)
- Pagamento (PDV) `colaborador_id` → Usuário (PDV) (Empresa, usuários e configuração)
- Pagamento (PDV) `condicao_pagamento_id` → Condição (PDV) (Financeiro)
- Pagamento (PDV) `forma_pagamento_id` → Forma de pagamento (PDV) (Financeiro)
- Pagamento (PDV) `identificador_id` → Identificador (PDV) (Financeiro)
- Pagamento (PDV) `maquininha_id` → Maquininha (PDV) (Financeiro)
- Pedido (PDV) `atendimento_id` → Atendimento (mesa/comanda) (Mesas e salão)
- Pedido (PDV) `cliente_id` → Cliente (PDV) (Clientes)
- Pedido (PDV) `endereco_entrega_id` → Endereço (PDV) (Clientes)
- Pedido (PDV) `usuario_id` → Usuário (PDV) (Empresa, usuários e configuração)
- Venda `treatment_id` → Ordem de serviço (Ordens de serviço)
- Lançamento financeiro (Financeiro) `cashier_session_id` → Caixa

## Notas

Regras e decisões do caixa e da sincronia: skill metrics-regras-negocio e Metrics.PDV/docs/CAIXA-E-SINCRONIA-PDV-X-CONFERENCIA.md.

## Pendências e decisões

- Aprovar as colunas propostas (pergunta 1 do documento de sincronia) e a sugestão nova sales.origin_identifier.
- Fiado (pergunta 5) e vale do funcionário (pergunta 4).
