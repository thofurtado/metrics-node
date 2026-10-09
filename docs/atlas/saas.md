# SaaS (banco master)

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/saas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

O banco master do SaaS Admin: cada cliente do Metrics (tenant) com seu domínio e o nome do banco próprio, e as credenciais globais de integração (iFood).

## Trabalhos que rodam o tempo todo

### Descobrir a loja de cada requisição — Excessivo
- **Frequência:** a cada requisição
- **Onde roda:** Nuvem (metrics-node), em toda requisição → `Banco master (tabela Tenant)`
- **Quantos:** Multiplica todas as sondagens acima (~34 por minuto por loja)
- **A cada vez:** 1 consulta ao banco master SEM memória (e sem índice: compara texto quebrado por vírgula). Domínio desconhecido (robô): 2 consultas e nada guardado.
- **Por que existe:** Cada loja tem seu próprio banco; o domínio da requisição diz qual.
- **Se espaçar:** Com memória de 30-60 s, suspender uma loja leva até 60 s para valer.
- **Proposta:** Memória de 30-60 s.
- **Onde no código:** `metrics-node/src/app.ts:141`, `metrics-node/src/lib/tenant-manager.ts:18`

### Registro (log) de toda requisição — Atenção
- **Frequência:** 2 linhas por requisição
- **Onde roda:** Nuvem (metrics-node)
- **A cada vez:** JSON no log, que o Docker guarda. Mais 1 linha por aviso ao vivo enviado.
- **Por que existe:** Investigar problemas pelo log do Coolify.
- **Proposta:** Registrar só avisos e erros (nível warn), mantendo os erros completos.
- **Onde no código:** `metrics-node/src/app.ts:56`, `metrics-node/src/lib/sse-manager.ts:79`

### Motores do Prisma (um processo por banco de loja) — Atenção
- **Frequência:** sempre ligados
- **Onde roda:** Nuvem (metrics-node)
- **Quantos:** ~14-16 processos query-engine (1 por banco), nunca fechados; o polling do iFood mantém todos acordados
- **A cada vez:** engineType "binary": cada consulta vai do Node ao motor por HTTP local e volta em JSON. O motor padrão (library) roda dentro do próprio Node e evita esse vai-e-volta.
- **Por que existe:** Cada loja tem seu banco e seu cliente Prisma.
- **Proposta:** Ensaio com o motor padrão (library) e medir; descobrir por que "binary" foi escolhido (arquivos travados no Windows?).
- **Desde:** 12/02/2026 (commit 4a7afe6)
- **Onde no código:** `metrics-node/prisma/schema.prisma:3`, `metrics-node/src/lib/tenant-manager.ts:76`

## Tabelas e Estrutura de Dados

### Cliente do Metrics (tenant) (`Tenant`)

- **Origem:** SaaS Admin (master)
- **O que é:** Cada restaurante cliente: domínio, código, nome do banco próprio, versão do schema e tipo de página do cardápio.
- **Quem lê:** metrics-node, para descobrir o banco de cada requisição pelo domínio (x-tenant-domain).

### Credencial global de integração (`SaaSIntegrationConfig`)

- **Origem:** SaaS Admin (master)
- **O que é:** Credenciais de integração que valem para todos os clientes (ex.: app do iFood). Têm prioridade sobre as variáveis de ambiente do backend.
