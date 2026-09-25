# Delivery e pedidos online

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/delivery.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Pedidos que nascem na nuvem (cardápio online, iFood, 99Food) ou no delivery do PDV, o vínculo dos itens das plataformas com os produtos do Metrics e o diário de eventos do iFood. Pela decisão R2/R3, com PDV o delivery sobe como venda do caixa que deu a baixa.

## Pedido online · `pedidos` (nuvem)

- **O que é:** Pedido do cardápio online, iFood, 99Food ou delivery feito no PDV, com cliente, endereço, status da entrega e NFC-e. Quando vira venda, tem o mesmo código da venda.
- **Quem grava:** O cardápio online, o recebimento do iFood (consulta a cada 30 s e webhook), o webhook do 99Food e o PDV (delivery lançado no balcão).
- **Quem lê:** PDV (pedidos pendentes e mudanças de status) e Conferência de caixa (barra de deliveries do dia).
- **Cresce:** Um por pedido.
- **Atenção:** O caixa é fixado quando o pedido nasce; pela decisão R3 deve ser o caixa que deu a baixa.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | Int (chave) | sim |  |  |
| `uuid` | String | sim |  | = id da Venda |
| `display_id` | Int | sim |  |  |
| `numero_diario` | Int | não |  |  |
| `origem` | String | sim |  |  |
| `atendimento_id` | Int | não |  |  |
| `cliente_id` | String | não |  |  |
| `endereco_entrega_id` | String | não |  |  |
| `subtotal` | Float | sim |  |  |
| `desconto_total` | Float | sim |  |  |
| `valor_frete` | Float | sim |  |  |
| `valor_servico` | Float | sim |  |  |
| `total_tributos` | Float | sim |  |  |
| `valor_final` | Float | sim |  |  |
| `valor_troco` | Float | sim |  |  |
| `data_abertura` | DateTime | sim |  |  |
| `data_fechamento` | DateTime | não |  |  |
| `status` | String | sim |  |  |
| `motivo_cancelamento` | String | não |  |  |
| `cpf_na_nota` | String | não |  |  |
| `status_delivery` | String | não |  |  |
| `entregador` | String | não |  |  |
| `observacao` | String | não |  |  |
| `hora_saida_rota` | DateTime | não |  |  |
| `caixa_id` | String | não |  | (texto, sem chave) |
| `usuario_id` | String | não |  |  |
| `chave_nfce` | String | não |  |  |
| `qrcode_nfce` | String | não |  |  |
| `is_contingencia` | Boolean | sim |  |  |
| `status_contingencia` | String | não |  |  |
| `xml_contingencia` | String | não |  |  |
| `data_envio_contingencia` | DateTime | não |  |  |
| `sincronizado_web` | Boolean | sim |  |  |
| `plataforma` | String | não |  | De qual plataforma o pedido veio ('IFOOD', '99FOOD', 'WEB', 'PDV', ...). Nulo = pedidos antigos, criados antes deste campo existir. Sem isso não dá pra saber a que marketplace um código de item (external_code) pertence. |

## Item do pedido · `pedido_itens` (nuvem)

- **O que é:** Itens do pedido online, com o código e o nome que o item tem no iFood/99Food.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | Int (chave) | sim |  |  |
| `uuid` | String | sim |  |  |
| `pedido_id` | Int | sim | Pedido online (Delivery e pedidos online) |  |
| `produto_id` | String | não |  |  |
| `quantidade` | Float | sim |  |  |
| `valor_unitario` | Float | sim |  |  |
| `desconto` | Float | sim |  |  |
| `valor_total` | Float | sim |  |  |
| `valor_tributos` | Float | sim |  |  |
| `cobra_servico` | Boolean | sim |  |  |
| `observacao` | String | não |  |  |
| `complementos_json` | String | não |  |  |
| `status_cozinha` | String | sim |  |  |
| `hora_inicio_preparo` | DateTime | não |  |  |
| `external_code` | String | não |  | (iFood/99Food) |
| `external_name` | String | não |  |  |

## Vínculo com delivery · `delivery_item_mappings` (nuvem)

- **O que é:** Liga o código do item no iFood/99Food a um produto do Metrics. Um vínculo vale para sempre e corrige os pedidos antigos daquele código.
- **Quem grava:** Tela Mercadorias → Vínculos com Delivery.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `platform` | String | sim |  | 'IFOOD' \| '99FOOD' |
| `external_code` | String | sim |  |  |
| `external_name` | String | não |  |  |
| `product_id` | String | sim | Produto (Cardápio e produtos) |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Diário do iFood · `ifood_api_logs` (nuvem)

- **O que é:** Cada chamada e cada evento do iFood (e ações do PDV no cancelamento), com tempo e resultado. É a evidência usada na homologação.
- **Quem lê:** Página de diagnóstico /delivery/ifood/diag.
- **Cresce:** Várias linhas por pedido do iFood.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `method` | String | sim |  |  |
| `endpoint` | String | sim |  |  |
| `order_id` | String | não |  |  |
| `local_order_id` | Int | não |  |  |
| `request_body` | Json | não |  |  |
| `response_status` | Int | não |  |  |
| `response_body` | Json | não |  |  |
| `duration_ms` | Int | sim |  |  |
| `success` | Boolean | sim |  |  |
| `error_message` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |

## Taxa de entrega (PDV) · `taxas_entrega` (PDV)

- **O que é:** Taxa por setor de bairros, cadastrada no PDV.
- **Atenção:** Nunca sobe para a nuvem.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `nome_setor` | string | sim |  |  |
| `valor` | decimal | sim |  |  |
| `bairros` | string | não |  |  |
| `uuid` | Guid | sim |  |  |
| `sincronizado_web` | bool | sim |  |  |

## Entregador (PDV) · `motoboys` (PDV)

- **O que é:** Cadastro dos entregadores usados no acerto do motoboy.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `nome` | string | sim |  |  |

## Ligações sem chave e propostas

- Pedido online → Venda: codigo · mesmo código

## Ligações com outros módulos

- Vínculo com delivery `product_id` → Produto (Cardápio e produtos)

## Pendências e decisões

- Decisão R2/R3: o delivery com PDV vira venda do caixa que deu a baixa, e a Conferência não pode contá-lo duas vezes.
