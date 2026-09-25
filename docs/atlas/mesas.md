# Mesas e salão

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/mesas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Mesa e comanda abertas. No PDV a mesa é um atendimento com pedidos; na nuvem existe só uma foto ao vivo das mesas abertas, sem ligação com venda ou caixa. Quando a mesa é paga, sai da foto e vira venda (módulo Caixa e vendas).

## Mesa aberta · `active_tables` (nuvem)

- **O que é:** A foto das mesas e comandas abertas agora.
- **Quem grava:** O PDV, a cada ciclo de 5 minutos (a mesa fechada sai da foto). O garçom no modo pela internet também abre mesa aqui.
- **Quem lê:** O garçom pela internet. O painel de mesas da web lê uma cópia em memória do mesmo envio do PDV, não esta tabela.
- **Cresce:** Não cresce: no máximo o número de mesas abertas.
- **Espelho:** Atendimento (mesa/comanda)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `identifier` | String (único) | sim |  | Mesa 07 (único) |
| `type` | String | sim |  | MESA \| COMANDA |
| `status` | String | sim |  | Ocupada, Ociosa, PedindoConta, Fechada |
| `people_count` | Int | sim |  |  |
| `total_amount` | Decimal | sim |  |  |
| `waiter_id` | String | não |  |  |
| `waiter_name` | String | não |  |  |
| `opened_at` | DateTime | sim |  |  |
| `closed_at` | DateTime | não |  |  |
| `updated_at` | DateTime | sim |  |  |

## Item na mesa · `active_table_items` (nuvem)

- **O que é:** Os itens de cada mesa aberta, na foto.
- **Quem grava:** O PDV (apaga e recria os itens de cada mesa a cada envio) e o garçom pela internet.
- **Atenção:** A confirmar: item lançado pelo garçom pela internet pode ser apagado pela foto seguinte do PDV.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `active_table_id` | String | sim | Mesa aberta (Mesas e salão) |  |
| `product_id` | String | não |  |  |
| `product_name` | String | sim |  |  |
| `quantity` | Float | sim |  |  |
| `unit_price` | Decimal | sim |  |  |
| `total_price` | Decimal | sim |  |  |
| `complements_json` | String | não |  |  |
| `observation` | String | não |  |  |
| `waiter_name` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |

## Atendimento (mesa/comanda) · `atendimentos` (PDV)

- **O que é:** A mesa ou comanda aberta no PDV, com a situação (Em consumo, Ociosa, Conta, Livre) e o número de pessoas. Tem os pedidos da mesa.
- **Espelho:** Mesa aberta

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `identificador` | string | sim |  | Mesa 07 |
| `status_atual` | string | sim |  |  |
| `data_fechamento` | DateTime | não |  |  |
| `hora_despacho_delivery` | DateTime | não |  |  |
| `hora_conclusao` | DateTime | não |  |  |
| `excluido` | bool | sim |  |  |
| `criada_em` | DateTime | sim |  |  |
| `atualizada_em` | DateTime | sim |  |  |
| `quantidade_pessoas` | int | sim |  |  |

## Transferência (PDV) · `log_transferencias` (PDV)

- **O que é:** Registro de cada transferência de item ou de mesa inteira: origem, destino, item, valor, motivo e operador.
- **Quem grava:** MesasView, na mesma gravação da transferência (tudo ou nada, desde o PDV 2.4.17.2).
- **Quem lê:** Ninguém ainda: não há tela e não sobe para a nuvem.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `tipo` | string | sim |  |  |
| `origem` | string | não |  |  |
| `destino` | string | não |  |  |
| `pedido_origem_id` | int | não |  |  |
| `pedido_destino_id` | int | não |  |  |
| `pedido_item_id` | int | não |  |  |
| `produto_nome` | string | não |  |  |
| `quantidade` | decimal | sim |  |  |
| `valor_total` | decimal | sim |  |  |
| `motivo` | string | não |  |  |
| `usuario_id` | Guid | não |  |  |
| `usuario_nome` | string | não |  |  |
| `criado_em` | DateTime | sim |  |  |

## Ligações sem chave e propostas

- Transferência (PDV) → Pedido (PDV): texto · pedido_origem_id / destino

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Atendimento (mesa/comanda) | Mesa aberta | Pelo nome da mesa (identificador), só enquanto está aberta. |

## Ligações com outros módulos

- Pedido (PDV) (Caixa e vendas) `atendimento_id` → Atendimento (mesa/comanda)

## Pendências e decisões

- Confirmar se o garçom pela internet é usado; se for, o envio de mesas do PDV não pode apagar os itens dele.
- A venda não guarda de que mesa veio (proposta sales.origin_identifier, módulo Caixa e vendas).
