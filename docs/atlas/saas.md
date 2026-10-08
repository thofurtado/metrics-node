# SaaS (banco master)

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/saas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

O banco master do SaaS Admin: cada cliente do Metrics (tenant) com seu domínio e o nome do banco próprio, e as credenciais globais de integração (iFood).

## Tabelas e Estrutura de Dados

### Cliente do Metrics (tenant) (`Tenant`)

- **Origem:** SaaS Admin (master)
- **O que é:** Cada restaurante cliente: domínio, código, nome do banco próprio, versão do schema e tipo de página do cardápio.
- **Quem lê:** metrics-node, para descobrir o banco de cada requisição pelo domínio (x-tenant-domain).

### Credencial global de integração (`SaaSIntegrationConfig`)

- **Origem:** SaaS Admin (master)
- **O que é:** Credenciais de integração que valem para todos os clientes (ex.: app do iFood). Têm prioridade sobre as variáveis de ambiente do backend.
