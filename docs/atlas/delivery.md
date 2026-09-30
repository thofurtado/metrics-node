# Delivery e pedidos online

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/delivery.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Pedidos que nascem na nuvem (cardápio online, iFood, 99Food) ou no delivery do PDV, o vínculo dos itens das plataformas com os produtos do Metrics e o diário de eventos do iFood. Pela decisão R2/R3, com PDV o delivery sobe como venda do caixa que deu a baixa.

## Tabelas e Estrutura de Dados

### Pedido online (`pedidos`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Pedido do cardápio online, iFood, 99Food ou delivery feito no PDV, com cliente, endereço, status da entrega e NFC-e. Quando vira venda, tem o mesmo código da venda.
- **Quem grava:** O cardápio online, o recebimento do iFood (consulta a cada 30 s e webhook), o webhook do 99Food e o PDV (delivery lançado no balcão).
- **Quem lê:** PDV (pedidos pendentes e mudanças de status) e Conferência de caixa (barra de deliveries do dia).
- **Cresce:** Um por pedido.

### Item do pedido (`pedido_itens`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Itens do pedido online, com o código e o nome que o item tem no iFood/99Food.

### Vínculo com delivery (`delivery_item_mappings`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga o código do item no iFood/99Food a um produto do Metrics. Um vínculo vale para sempre e corrige os pedidos antigos daquele código.
- **Quem grava:** Tela Mercadorias → Vínculos com Delivery.

### Diário do iFood (`ifood_api_logs`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada chamada e cada evento do iFood (e ações do PDV no cancelamento), com tempo e resultado. É a evidência usada na homologação.
- **Quem lê:** Página de diagnóstico /delivery/ifood/diag.
- **Cresce:** Várias linhas por pedido do iFood.

### Taxa de entrega (PDV) (`taxas_entrega`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Taxa por setor de bairros, cadastrada no PDV.

### Entregador (PDV) (`motoboys`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cadastro dos entregadores usados no acerto do motoboy.

## Pendências e decisões

- Decisão R2/R3: o delivery com PDV vira venda do caixa que deu a baixa, e a Conferência não pode contá-lo duas vezes.
