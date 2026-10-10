# Clientes

> Gerado por `atlas.py` em 10/10/2026 a partir do código e de `modulos/clientes.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Cadastro de clientes e endereços, usado no delivery, no fiado e nas ordens de serviço.

## Regras de Negócio e Porquês

### Clientes do sistema antigo chegam pelo Metrics.Sync (`regra-clientes-do-sistema-antigo`)
- **Regra:** Com a origem Athos, o Metrics.Sync manda à nuvem os clientes ATIVOS (nome, CPF/CNPJ, telefone, e-mail e endereço); o PDV baixa da nuvem. Cada cliente ganha sempre o mesmo código (empresa + origem + código no Athos): rodar de novo atualiza, nunca duplica. Cliente que já existe na nuvem (mesmo CPF/CNPJ, telefone ou nome completo) é atualizado no próprio cadastro, sem perder telefone, e-mail e endereço. O limite de crédito e o saldo do fiado do Athos ainda não vêm.
- **Por que é assim:** Katatau, 10/10/2026: o Sync só trazia produtos e o PDV ficou sem os clientes do fiado ("como fazemos a prazo sem cliente?").
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.Sync/Services/AthosDataSourceAdapter.cs:211`, `Metrics.Sync/Services/EnvioDeClientes.cs:92`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:163`

## Trabalhos que rodam o tempo todo

### Clientes (PDV) — Excessivo
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre a lista inteira
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/clients`
- **Quantos:** 1 por loja
- **A cada vez:** A tabela inteira de clientes com endereços e fiados, toda vez; cresce com a base. O PDV ainda faz 1 consulta local por cliente.
- **Por que existe:** Cliente cadastrado na web ou no cardápio aparece no PDV (delivery, fiado).
- **Proposta:** Usar o carimbo de mudança de clientes que /sync/status já devolve.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:1051`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:102`

### Metrics.Sync: clientes do Athos para a nuvem — Ok
- **Frequência:** na mesma rodada do catálogo (a cada 5 min, padrão); "Sincronizar agora" manda todos
- **Onde roda:** Computador da loja com o Metrics.Sync (origem Athos) → `Nuvem: GET /api/pdv/sync/clients e POST /api/pdv/sync/clients (lotes de 100), só quando há cliente novo ou alterado`
- **Quantos:** Só lojas com Athos e o Sync 1.4.5.0 ou mais novo; quase sempre nenhuma chamada (nada mudou)
- **A cada vez:** Lê os clientes ativos do Athos (nome e CPF em cliente_fisico; razão social, fantasia e CNPJ em cliente_juridico; telefone em cliente_contato; endereço em cliente_endereco), reconhece quem já existe na nuvem e manda os novos ou alterados. A impressão digital de cada cliente enviado fica em %AppData%\Metrics.Sync\clientes-enviados-<empresa>-<origem>.json. Falha aqui não derruba o envio dos produtos.
- **Por que existe:** Katatau (10/10/2026): sem os clientes não havia como vender a prazo no PDV. 57 clientes ativos na cópia do Athos de 27/08/2026.
- **Proposta:** Levar o limite de crédito (falta coluna na nuvem) e, se o Thomás decidir, o saldo do fiado em aberto.
- **Onde no código:** `Metrics.Sync/Services/SyncOrchestrator.cs:138`, `Metrics.Sync/Services/EnvioDeClientes.cs:92`, `Metrics.Sync/Services/AthosDataSourceAdapter.cs:211`

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
