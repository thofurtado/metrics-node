# RH e ponto

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/rh.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Funcionários, batidas de ponto (o dia do ponto vira às 07:00 no backend), pontuação, lançamentos de folha (vale, salário, consumo) e regras de hora extra.

## Funcionário · `employees` (nuvem)

- **O que é:** Funcionário do RH, com salário, forma de registro, PIN do ponto e limite de compra a prazo. Pode estar ligado a um usuário do sistema.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `role` | String | sim |  |  |
| `admissionDate` | DateTime | sim |  |  |
| `pin` | String | sim |  |  |
| `salary` | Decimal | não |  |  |
| `points` | Int | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `user_id` | String (único) | não | Usuário (Empresa, usuários e configuração) |  |
| `registrationType` | String | sim |  |  |
| `dailyRate` | Decimal | não |  |  |
| `hasCestaBasica` | Boolean | sim |  |  |
| `isRegistered` | Boolean | sim |  |  |
| `overtimeValue` | Decimal | sim |  |  |
| `transportAllowance` | Decimal | sim |  |  |
| `photo_url` | String | não |  |  |
| `allow_term_sales` | Boolean | sim |  |  |
| `term_credit_limit` | Decimal | não |  |  |

## Batida de ponto · `time_clocks` (nuvem)

- **O que é:** Entrada, intervalo e saída de um dia de trabalho. O dia é o de competência: batida antes das 07:00 conta para o dia anterior.
- **Quem grava:** App Metrics.Ponto (online e sincronização offline) e ajustes do administrador.
- **Cresce:** Uma linha por funcionário por dia.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `employee_id` | String | sim | Funcionário (RH e ponto) |  |
| `date` | DateTime | sim |  |  |
| `clockIn` | DateTime | não |  |  |
| `breakStart` | DateTime | não |  |  |
| `breakEnd` | DateTime | não |  |  |
| `clockOut` | DateTime | não |  |  |
| `isExtraDay` | Boolean | sim |  |  |
| `negotiatedValue` | Decimal | não |  |  |
| `isVerified` | Boolean | sim |  |  |
| `notes` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `extraClockIn` | DateTime | não |  |  |
| `extraClockOut` | DateTime | não |  |  |
| `absenceReason` | String | não |  |  |
| `isJustifiedAbsence` | Boolean | sim |  |  |

## Pontuação do funcionário · `employee_point_snapshots` (nuvem)

- **O que é:** Foto da pontuação e do valor do ponto em uma data.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `employee_id` | String | sim | Funcionário (RH e ponto) |  |
| `snapshotDate` | DateTime | sim |  |  |
| `points` | Int | sim |  |  |
| `pointValue` | Decimal | sim |  |  |
| `totalAmount` | Decimal | sim |  |  |
| `created_at` | DateTime | sim |  |  |

## Lançamento de folha · `payroll_entries` (nuvem)

- **O que é:** Vale, salário, benefício, consumo e outros lançamentos da folha do funcionário.
- **Quem grava:** Web (RH), conferência de caixa (vales) e sincronia de vendas do PDV (consumo de funcionário).

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `employee_id` | String | sim | Funcionário (RH e ponto) |  |
| `description` | String | sim |  |  |
| `amount` | Decimal | sim |  |  |
| `type` | PayrollType | sim |  |  |
| `referenceDate` | DateTime | sim |  |  |
| `status` | String | sim |  |  |
| `transaction_id` | String | não | Lançamento financeiro (Financeiro) |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Regras de hora extra · `hr_rule_histories` (nuvem)

- **O que é:** Divisor, multiplicadores e jornada diária, com data de início de vigência.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `valid_from` | DateTime | sim |  |  |
| `he_divisor` | Int | sim |  |  |
| `he_multiplier_standard` | Decimal | sim |  |  |
| `he_multiplier_special` | Decimal | sim |  |  |
| `daily_workload_minutes` | Int | sim |  |  |
| `tolerance_minutes` | Int | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Feriado · `holidays` (nuvem)

- **O que é:** Feriados usados no cálculo de horas.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `date` | DateTime (único) | sim |  |  |
| `name` | String | sim |  |  |
| `type` | String | sim |  |  |
| `created_at` | DateTime | sim |  |  |

## Ligações com outros módulos

- Funcionário `user_id` → Usuário (Empresa, usuários e configuração)
- Lançamento de folha `transaction_id` → Lançamento financeiro (Financeiro)
- Lançamento do caixa (Caixa e vendas) `employee_id` → Funcionário

## Pendências e decisões

- Vale e consumo lançados no PDV usam usuário do sistema, não funcionário do RH (pergunta 4).
