# Ordens de serviço

> Gerado por `atlas.py` em 09/10/2026 a partir do código e de `modulos/servicos.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Atendimento técnico: a ordem de serviço de um equipamento do cliente, os itens e serviços usados, o andamento e o pagamento.

## Trabalhos que rodam o tempo todo

### Windy: conexão ao vivo (comandos remotos) — Defeito
- **Frequência:** conexão sempre aberta; provavelmente cai e reabre a cada ~155 s
- **Onde roda:** Computador da loja com o Windy → `Nuvem: WS /equipments/{id}/ws`
- **Quantos:** 1 por computador com Windy
- **A cada vez:** O Windy desiste depois de 150 s sem mensagem; a nuvem só manda "ping" a cada 120 s, e o ping não conta como mensagem. Cada reabertura grava "online" no banco, lê ao fechar e manda uma telemetria extra. A confirmar no windy_ws_log.txt ("WS Connected" a cada ~2,5 min).
- **Por que existe:** Receber comandos do suporte (atualizar, reiniciar, acesso remoto) na hora.
- **Proposta:** Tirar o prazo de 150 s ou a nuvem mandar uma mensagem de vida.
- **Onde no código:** `Metrics.Windy/Services/TelemetryService.cs:377`, `Metrics.Windy/Services/TelemetryService.cs:410`, `metrics-node/src/modules/equipments/http/controllers/routes.ts:48`

### Equipamentos e telemetria na web — Excessivo
- **Frequência:** 2 consultas a cada 10 s com a aba visível
- **Onde roda:** Navegador, /clients-equipments e aba Equipamentos de /treatments → `Nuvem: GET /clients (todos os clientes com todos os equipamentos) e /equipments/orphans`
- **Quantos:** 1 por aba da equipe interna
- **Por que existe:** Equipe de suporte ver quem está online.
- **Se espaçar:** O botão "Atualizar telemetria" já força a atualização na hora.
- **Proposta:** 30-60 s.
- **Onde no código:** `metrics/src/pages/app/clients-equipments/index.tsx:102`

### Central VPN (Headscale) na web — Atenção
- **Frequência:** a cada 10 s com a aba visível
- **Onde roda:** Navegador, aba Rede VPN de /treatments → `Nuvem: GET /vpn/networks (2 consultas + chamada ao Headscale)`
- **Quantos:** 1 por aba da equipe interna
- **Por que existe:** Ver as máquinas da VPN de suporte.
- **Proposta:** 60 s (já existe o botão Atualizar).
- **Onde no código:** `metrics/src/pages/app/treatments/components/vpn-noc-tab.tsx:28`

### Windy: telemetria do computador — Atenção
- **Frequência:** a cada 2 min, mais a cada reabertura da conexão e ao abrir o painel
- **Onde roda:** Computador da loja com o Windy → `Nuvem: POST /equipments/{id}/telemetry (~2-4 KB)`
- **Quantos:** 1 por computador
- **Por que existe:** Suporte ver CPU, memória, discos e RustDesk de cada computador da loja.
- **Proposta:** 5-10 min.
- **Onde no código:** `Metrics.Windy/Services/TelemetryService.cs:271`

## Tabelas e Estrutura de Dados

### Ordem de serviço (`treatments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Atendimento técnico de um cliente, ligado a um equipamento e a um responsável.

### Item da O.S. (`treatment_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Produto, insumo ou serviço usado na ordem de serviço (baixa estoque).

### Serviço (`services`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Serviço cobrado (mão de obra).

### Equipamento (`equipments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Equipamento do cliente atendido.

### Andamento (`interactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Registro do andamento da ordem de serviço, por usuário.

### O.S. × lançamento (`treatment_transactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga a ordem de serviço aos lançamentos financeiros que ela gerou.

### Pagamento da O.S. (`payment_entries`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Forma de pagamento, parcelas e valor pagos na ordem de serviço.

## Pendências e decisões

- Descrições tiradas dos nomes e das ligações: confirmar com quem usa o módulo.
