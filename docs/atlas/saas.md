# SaaS (banco master)

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/saas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

O banco master do SaaS Admin: cada cliente do Metrics (tenant) com seu domínio e o nome do banco próprio, e as credenciais globais de integração (iFood).

## Cliente do Metrics (tenant) · `Tenant` (SaaS (master))

- **O que é:** Cada restaurante cliente: domínio, código, nome do banco próprio, versão do schema e tipo de página do cardápio.
- **Quem lê:** metrics-node, para descobrir o banco de cada requisição pelo domínio (x-tenant-domain).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `domain` | String (único) | sim |  |  |
| `dbName` | String (único) | sim |  | Nome do banco de dados no Postgres (ex: db_marujo) |
| `code` | String (único) | não |  |  |
| `schemaVersion` | String | não |  |  |
| `dbSyncedAt` | DateTime | não |  |  |
| `status` | String | sim |  | active, suspended, pending |
| `landingPageType` | String | sim |  | NONE, CUSTOM, MENU |
| `landingPageSlug` | String | não |  |  |
| `createdAt` | DateTime | sim |  |  |
| `updatedAt` | DateTime | sim |  |  |

## Credencial global de integração · `SaaSIntegrationConfig` (SaaS (master))

- **O que é:** Credenciais de integração que valem para todos os clientes (ex.: app do iFood). Têm prioridade sobre as variáveis de ambiente do backend.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `provider` | String (único) | sim |  |  |
| `clientId` | String | sim |  |  |
| `clientSecret` | String | sim |  |  |
| `updatedAt` | DateTime | sim |  |  |
