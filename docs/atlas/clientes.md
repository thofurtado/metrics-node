# Clientes

> Gerado por `atlas.py` em 10/10/2026 a partir do código e de `modulos/clientes.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Cadastro de clientes e endereços, usado no delivery, no fiado e nas ordens de serviço.

## Regras de Negócio e Porquês

### Clientes do sistema antigo NÃO vêm (desligado no Sync 1.4.6.0) (`regra-clientes-do-sistema-antigo`)
- **Regra:** Os clientes do Athos não vão para a nuvem: valem só os clientes cadastrados na web (e os cadastrados no PDV, que sobem). O Metrics.Sync 1.4.5.0 mandava os clientes ativos do Athos a cada rodada; a 1.4.6.0 desligou o envio (o código ficou, sem uso).
- **Por que é assim:** Decisão do Thomás de 10/10/2026: "não queremos os clientes da Athos, só os clientes que já estão cadastrados na web".
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.Sync/Services/AthosDataSourceAdapter.cs:211`, `Metrics.Sync/Services/EnvioDeClientes.cs:92`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:163`

### Clientes da nuvem no PDV: telefone pode faltar ou repetir (`regra-clientes-no-pdv`)
- **Regra:** No PDV o telefone do cliente não é único (cliente sem telefone fica com o telefone vazio; família pode repetir o telefone). O cliente da nuvem é achado pelo código; pelo telefone só quando o cliente do PDV não é outro cliente da nuvem. O limite de crédito do PDV não é apagado (a nuvem não guarda limite). O saldo do fiado = contas abertas na nuvem + fiado das vendas deste PDV que ainda não subiram. Cadastro mudado no PDV e ainda não enviado não é sobrescrito. Os clientes descem depois das vendas e dos cancelamentos. No cadastro rápido do PDV só o nome é obrigatório.
- **Por que é assim:** Katatau, 10/10/2026: os 29 clientes da nuvem não têm telefone; com o telefone único, o 2º cliente sem telefone derrubava a gravação e a sincronia dos clientes parava ali a cada ciclo (o PDV não trazia os clientes). Decisão de 28/09: cliente pode ser cadastrado sem telefone.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/ClientesDaNuvem.cs`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs (BaixarClientesAsync)`, `Metrics.PDV/Metrics.Shared/Data/DatabaseBootstrapper.cs (SqlFuncionariosDoRhETelefone)`, `Metrics.PDV/Metrics.PDV/Views/ModalClienteWindow.xaml.cs`

## Trabalhos que rodam o tempo todo

### Clientes (PDV) — Excessivo
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre a lista inteira, depois das vendas e dos cancelamentos
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/clients`
- **Quantos:** 1 por loja
- **A cada vez:** A tabela inteira de clientes com endereços e saldo do fiado, toda vez; cresce com a base. Desde a 2.5.23.0 o PDV lê os clientes locais de uma vez e grava uma vez só no fim (antes eram uma consulta por cliente e uma gravação por cliente novo).
- **Por que existe:** Cliente cadastrado na web ou no cardápio aparece no PDV (delivery, fiado).
- **Proposta:** Usar o carimbo de mudança de clientes que /sync/status já devolve.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:1051`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:102`

### Metrics.Sync: clientes do Athos para a nuvem — Ok
- **Frequência:** nenhuma (desligado no Sync 1.4.6.0, 10/10/2026)
- **Onde roda:** Computador da loja com o Metrics.Sync (origem Athos) → `Nuvem: GET /api/pdv/sync/clients e POST /api/pdv/sync/clients (lotes de 100), só quando há cliente novo ou alterado`
- **Quantos:** Só lojas com Athos e o Sync 1.4.5.0 ou mais novo; quase sempre nenhuma chamada (nada mudou)
- **A cada vez:** Nada desde a 1.4.6.0: os clientes do Athos não vão mais para a nuvem (decisão do Thomás).
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
