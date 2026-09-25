# Empresa, usuários e configuração

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/empresa.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Usuários do sistema e seus módulos liberados, o perfil da empresa (White Label do cardápio, horários, setores de entrega) e as configurações gerais.

## Usuário · `users` (nuvem)

- **O que é:** Quem faz login no sistema (web, PDV, app), com papel (ADMIN…).
- **Espelho:** Usuário (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `role` | Role | sim |  |  |
| `email` | String (único) | sim |  |  |
| `password_hash` | String | sim |  |  |
| `pin_hash` | String | não |  |  |
| `introduction` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Módulo liberado · `modules` (nuvem)

- **O que é:** Módulo do sistema que pode ser liberado para um usuário.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `slug` | String (único) | sim |  |  |
| `description` | String | não |  |  |

## Usuário × módulo · `user_modules` (nuvem)

- **O que é:** Quais módulos cada usuário acessa.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `user_id` | String | sim | Usuário (Empresa, usuários e configuração) |  |
| `module_id` | String | sim | Módulo liberado (Empresa, usuários e configuração) |  |

## Perfil da empresa · `company_profiles` (nuvem)

- **O que é:** Nome, contato, White Label do cardápio (tema, bairros, Pix), integrações.
- **Atenção:** Coluna nova aqui quebra o tenant que não rodou a migration (o Prisma lê todas as colunas).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `tradeName` | String | sim |  |  |
| `companyName` | String | não |  |  |
| `document` | String | não |  |  |
| `logo_url` | String | não |  |  |
| `banner_url` | String | não |  |  |
| `primaryColor` | String | sim |  | Design Tokens (White Label) |
| `secondaryColor` | String | sim |  |  |
| `backgroundColor` | String | sim |  |  |
| `whatsappNumber` | String | sim |  |  |
| `street` | String | não |  |  |
| `number` | String | não |  |  |
| `neighborhood` | String | não |  |  |
| `city` | String | não |  |  |
| `state` | String | não |  |  |
| `zipcode` | String | não |  |  |
| `deliveryFee` | Float | sim |  | Regras de Entrega (Padrão iFood / Anota AI) |
| `minOrderValue` | Float | sim |  |  |
| `deliveryTimeMin` | Int | sim |  |  |
| `deliveryTimeMax` | Int | sim |  |  |
| `isOpenManual` | Boolean | sim |  |  |
| `availableNeighborhoods` | String[] | sim |  | Bairros e Setores de Entrega |
| `deliverySectors` | Json | não |  |  |
| `ifoodMerchantId` | String | não |  | Credenciais de Integração Marketplace e Pagamentos |
| `ifoodAccessToken` | String | não |  |  |
| `ifoodRefreshToken` | String | não |  |  |
| `ifoodTokenExpiresAt` | DateTime | não |  |  |
| `anotaAiApiKey` | String | não |  |  |
| `pixKey` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Horário de funcionamento · `business_hours` (nuvem)

- **O que é:** Horários do cardápio online por dia da semana.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `company_profile_id` | String | sim | Perfil da empresa (Empresa, usuários e configuração) |  |
| `dayOfWeek` | Int | sim |  | 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sab |
| `openTime` | String | sim |  | ex: "18:00" |
| `closeTime` | String | sim |  | ex: "23:00" |
| `isOpen` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Configuração do sistema · `system_configs` (nuvem)

- **O que é:** Módulos ligados, fechamento cego, perfil financeiro, cartões do painel e integrações.
- **Atenção:** Guarda uma chave de API em texto (gemini_api_key).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `merchandise_module` | Boolean | sim |  |  |
| `financial_module` | Boolean | sim |  |  |
| `treatments_module` | Boolean | sim |  |  |
| `cashier_module` | Boolean | sim |  |  |
| `cashier_default_origin` | String | sim |  |  |
| `blind_cashier_closure` | Boolean | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `hr_module` | Boolean | sim |  |  |
| `cestaBasicaValue` | Decimal | sim |  |  |
| `financial_management_profile` | String | sim |  |  |
| `dashboard_cards` | Json | não |  |  |
| `stock_control_module` | Boolean | sim |  |  |
| `gemini_api_key` | String | não |  |  |
| `gemini_model` | String | sim |  |  |
| `auto_nfe_mapping` | Boolean | sim |  |  |

## Usuário (PDV) · `users` (PDV)

- **O que é:** Cópia local dos usuários, baixada a cada ciclo (usuário que sumiu da nuvem é apagado do PDV).
- **Espelho:** Usuário

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | Guid (chave) | sim |  |  |
| `name` | string | sim |  |  |
| `email` | string | sim |  |  |
| `password_hash` | string | sim |  |  |
| `pin_hash` | string | não |  |  |
| `role` | string | sim |  |  |

## Configuração (PDV) · `configuracoes` (PDV)

- **O que é:** Chave e valor das configurações do terminal (ex.: Fiscal.ValidacaoRigorosa, total de mesas).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `chave` | string | sim |  |  |
| `valor` | string | sim |  |  |

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Usuário (PDV) | Usuário | Mesmo código; baixado a cada ciclo. |

## Ligações com outros módulos

- Andamento (Ordens de serviço) `user_id` → Usuário
- Evasão de estoque (PDV) (Estoque e compras) `usuario_id` → Usuário (PDV)
- Funcionário (RH e ponto) `user_id` → Usuário
- Ordem de serviço (Ordens de serviço) `user_id` → Usuário
- Pagamento (PDV) (Caixa e vendas) `colaborador_id` → Usuário (PDV)
- Pedido (PDV) (Caixa e vendas) `usuario_id` → Usuário (PDV)
