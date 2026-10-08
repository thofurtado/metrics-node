# Mesas e salão

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/mesas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Mesa e comanda abertas. No PDV a mesa é um atendimento com pedidos; na nuvem existe só uma foto ao vivo das mesas abertas, sem ligação com venda ou caixa. Quando a mesa é paga, sai da foto e vira venda (módulo Caixa e vendas).

## Tabelas e Estrutura de Dados

### Mesa aberta (`active_tables`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** A foto das mesas e comandas abertas agora.
- **Quem grava:** O PDV, a cada ciclo de 5 minutos (a mesa fechada sai da foto). O garçom no modo pela internet também abre mesa aqui.
- **Quem lê:** O garçom pela internet. O painel de mesas da web lê uma cópia em memória do mesmo envio do PDV, não esta tabela.
- **Cresce:** Não cresce: no máximo o número de mesas abertas.
- **Espelho no PDV/nuvem:** Atendimento (mesa/comanda) (`atendimentos`)

### Item na mesa (`active_table_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Os itens de cada mesa aberta, na foto.
- **Quem grava:** O PDV (apaga e recria os itens de cada mesa a cada envio) e o garçom pela internet.

### Atendimento (mesa/comanda) (`atendimentos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** A mesa ou comanda aberta no PDV, com a situação (Em consumo, Ociosa, Conta, Livre) e o número de pessoas. Tem os pedidos da mesa.
- **Espelho no PDV/nuvem:** Mesa aberta (`active_tables`)

### Transferência (PDV) (`log_transferencias`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Registro de cada transferência de item ou de mesa inteira: origem, destino, item, valor, motivo e operador.
- **Quem grava:** MesasView, na mesma gravação da transferência (tudo ou nada, desde o PDV 2.4.17.2).
- **Quem lê:** Ninguém ainda: não há tela e não sobe para a nuvem.

### Lançamento do garçom já recebido (`garcom_idempotencia`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cada lançamento do app do garçom chega com uma chave criada no celular. A primeira vez lança os itens e guarda a resposta aqui; se o celular reenviar (internet caiu no meio, toque duplo), o servidor devolve a resposta guardada e não lança de novo. A mesma chave numa mesa diferente é recusada.
- **Quem grava:** Serviço do servidor da loja, ao receber o lançamento do app do garçom (LancamentoDoGarcom).
- **Quem lê:** O mesmo serviço, a cada lançamento, para saber se aquela chave já chegou.
- **Cresce:** Uma linha por lançamento do app; o servidor apaga as de mais de 2 dias (limpeza automática).

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Atendimento (mesa/comanda) | Mesa aberta | Pelo nome da mesa (identificador), só enquanto está aberta. |

## Pendências e decisões

- Confirmar se o garçom pela internet é usado; se for, o envio de mesas do PDV não pode apagar os itens dele.
- A venda não guarda de que mesa veio (proposta sales.origin_identifier, módulo Caixa e vendas).
