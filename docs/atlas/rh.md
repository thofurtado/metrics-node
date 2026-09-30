# RH e ponto

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/rh.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Funcionários, batidas de ponto (o dia do ponto vira às 07:00 no backend), pontuação, lançamentos de folha (vale, salário, consumo) e regras de hora extra.

## Tabelas e Estrutura de Dados

### Funcionário (`employees`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Funcionário do RH, com salário, forma de registro, PIN do ponto e limite de compra a prazo. Pode estar ligado a um usuário do sistema.

### Batida de ponto (`time_clocks`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Entrada, intervalo e saída de um dia de trabalho. O dia é o de competência: batida antes das 07:00 conta para o dia anterior.
- **Quem grava:** App Metrics.Ponto (online e sincronização offline) e ajustes do administrador.
- **Cresce:** Uma linha por funcionário por dia.

### Pontuação do funcionário (`employee_point_snapshots`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Foto da pontuação e do valor do ponto em uma data.

### Lançamento de folha (`payroll_entries`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Vale, salário, benefício, consumo e outros lançamentos da folha do funcionário.
- **Quem grava:** Web (RH), conferência de caixa (vales) e sincronia de vendas do PDV (consumo de funcionário).

### Regras de hora extra (`hr_rule_histories`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Divisor, multiplicadores e jornada diária, com data de início de vigência.

### Feriado (`holidays`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Feriados usados no cálculo de horas.

## Pendências e decisões

- Vale e consumo lançados no PDV usam usuário do sistema, não funcionário do RH (pergunta 4).
