# Clientes

> Gerado por `atlas.py` em 09/10/2026 a partir do código e de `modulos/clientes.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Cadastro de clientes e endereços, usado no delivery, no fiado e nas ordens de serviço.

## Trabalhos que rodam o tempo todo

### Clientes (PDV) — Excessivo
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre a lista inteira
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/clients`
- **Quantos:** 1 por loja
- **A cada vez:** A tabela inteira de clientes com endereços e fiados, toda vez; cresce com a base. O PDV ainda faz 1 consulta local por cliente.
- **Por que existe:** Cliente cadastrado na web ou no cardápio aparece no PDV (delivery, fiado).
- **Proposta:** Usar o carimbo de mudança de clientes que /sync/status já devolve.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:1051`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:102`

## Tabelas e Estrutura de Dados

### Cliente (`clients`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cadastro do cliente (nome, telefone, documento, e-mail).
- **Espelho no PDV/nuvem:** Cliente (PDV) (`clientes`)

### Endereço (`addresses`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Endereços do cliente, com o principal marcado.
- **Espelho no PDV/nuvem:** Endereço (PDV) (`enderecos_cliente`)

### Grupo de clientes (`client_groups`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Agrupamento de clientes com usuário e chave de VPN (Headscale).

### Cliente (PDV) (`clientes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local, mais o saldo devedor do fiado e o limite de crédito. Cliente cadastrado no PDV sobe para a nuvem (voltou a subir no 2.4.19.0).
- **Espelho no PDV/nuvem:** Cliente (`clients`)

### Endereço (PDV) (`enderecos_cliente`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Endereços do cliente no PDV.
- **Espelho no PDV/nuvem:** Endereço (`addresses`)

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Cliente (PDV) | Cliente | Mesmo código; sobe e desce a cada ciclo (o download sobrescreve o saldo devedor local). |
| Endereço (PDV) | Endereço | Sobe junto com o cliente (só o principal). |
