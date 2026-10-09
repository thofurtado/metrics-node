# RH e ponto

> Gerado por `atlas.py` em 09/10/2026 a partir do código e de `modulos/rh.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Funcionários, batidas de ponto (o dia do ponto vira às 04:00 de Brasília), pontuação, lançamentos de folha (vale, salário, consumo) e regras de hora extra.

## Regras de Negócio e Porquês

### Uma conta só para as horas do ponto (`regra-ponto-conta-unica`)
- **Regra:** Espelho, resumo do mês e PDF usam a mesma conta, feita no servidor (POST /hr/ponto/apurar e GET /hr/ponto/resumo). Nenhuma tela calcula hora extra por conta própria.
- **Por que é assim:** Antes cada tela fazia a sua conta (7h20 por dia, 60% em tudo, sem noturno) e os números não batiam entre o espelho, o resumo e o PDF. Decisão D1 (07/10/2026).
- **Decisão:** 08/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`, `metrics-node/src/modules/hr/ponto/servico.ts`, `metrics-node/src/modules/hr/http/controllers/ponto.ts`, `metrics-node/docs/ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md`

### Cada loja tem a sua regra de hora extra, com data de início, e o sistema só sugere (`regra-ponto-regra-da-loja`)
- **Regra:** A loja escolhe a regra (CLT, convenção de bares e restaurantes de SP, Litoral Norte ou personalizada) a partir de uma data; os dias antes continuam com a regra anterior. Ao lado de cada campo aparece o que a lei pede, só como aviso: nada bloqueia. Sem regra, vale a CLT; Marujo, Giardinetto e Katatau começam com a conta do espelho de hoje e o percentual de cada uma (60%, 70% e 50%, desde o início, gravado pela migration só no banco de cada uma); outra loja que já usava o ponto começa com a Conta antiga do espelho (7h20, 60%, sem noturno) até escolher.
- **Por que é assim:** O sistema é para ser sugestivo: há lojas que pagam diferente da lei e precisam operar sem bloqueio (D12, D18). A data de início protege os meses já fechados. As lojas de hoje não podem ver os números mudarem sozinhos (D19).
- **Decisão:** 07/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/hr/ponto/regra.ts`, `metrics-node/src/modules/hr/ponto/modelos.ts`, `metrics/src/pages/hr/settings/regra-hora-extra-settings.tsx`, `metrics/src/components/hr/aviso-regra-do-ponto.tsx`, `metrics-node/prisma/migrations/20261008100000_regra_de_hora_extra_da_loja/migration.sql`

### Hora extra pelo dia e pela semana, sem contar duas vezes (`regra-ponto-extra-dia-e-semana`)
- **Regra:** Extra do dia = o que passa da jornada do dia; até a tolerância (10 minutos) não conta, passou dela conta tudo. Com contar pela semana ligado, o que passa de 44 horas na semana (sem as horas que já foram extra no dia) também é extra e entra no domingo daquela semana; a semana que fecha no mês seguinte vai para o mês seguinte.
- **Por que é assim:** CLT, art. 58 (8 horas por dia; variações de até 5 minutos por marcação e 10 por dia não contam) e art. 59 (até 2 horas extras por dia, com adicional de pelo menos 50%), conferidos em https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm em 07 e 08/10/2026. As 44 horas por semana vêm da Constituição, art. 7º, XIII (a conferir na fonte).
- **Decisão:** 07/10/2026 por Lei (CLT)
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`

### Domingo e feriado: a loja escolhe o que vale 100% (`regra-ponto-domingo-feriado`)
- **Regra:** Domingo: só o que passa da jornada a 100%, o dia todo normal, ou o dia todo a 100%. Feriado (da lista de feriados do RH): o mesmo. O percentual vem da regra da loja (100% nas 3 lojas de hoje).
- **Por que é assim:** CLT, art. 67: folga semanal de 24 horas, de preferência no domingo, com escala de revezamento onde se trabalha no domingo (conferido em https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm em 08/10/2026). Domingo e feriado trabalhados sem folga compensatória pagos em dobro: Lei 605/1949, art. 9º, e Súmula 146 do TST (a conferir na fonte).
- **Decisão:** 07/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`

### Adicional noturno das 22h às 5h, com a hora reduzida (`regra-ponto-noturno`)
- **Regra:** As horas trabalhadas entre 22h e 5h (horário de Brasília) aparecem no espelho sempre. Se a regra da loja liga o adicional, elas valem o percentual dela (CLT: 20%) e, com a hora reduzida, cada 52 minutos e 30 segundos contam como 1 hora.
- **Por que é assim:** CLT, art. 73 (adicional de pelo menos 20% e hora noturna de 52min30s). Convenções podem pagar mais (bares e restaurantes de SP: 20% ou 35%). Desligado, as horas continuam aparecendo (D18). Fonte: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm.
- **Decisão:** 07/10/2026 por Lei (CLT) + Thomás Furtado (D18)
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`

### Diarista: a diária, as horas a mais e a dobra (`regra-ponto-diarista`)
- **Regra:** A hora do diarista é a diária ÷ as horas padrão da diária (configuração da regra, ex.: 8h). O que passa dessas horas é hora extra e SOMA à diária, se a loja ligar Diarista recebe hora extra ou se houver valor combinado com a pessoa. O dia de dobra com valor fechado SUBSTITUI a diária daquele dia.
- **Por que é assim:** D14, D17 e D25. O valor combinado com uma pessoa é um acordo com ela, então vale mesmo com a loja desligada; sem isso o dono digitaria o valor e nada aconteceria.
- **Decisão:** 08/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`

### Os valores do cadastro do funcionário (`regra-ponto-valores-do-cadastro`)
- **Regra:** Um campo de valor com o nome do tipo: salário mensal (registrado e sem registro), valor da hora (horista) ou valor da diária (diarista). Para quem não é diarista, o campo da diária é o Valor da dobra (preenche sozinho o dia de dobra no espelho). Valor da hora extra: vazio = pela regra da loja (a tela mostra o valor calculado); preenchido = o combinado com a pessoa.
- **Por que é assim:** D15, D16 e D26. Os valores continuam nas mesmas colunas (salary, dailyRate, overtimeValue), sem mexer nos dados das lojas. Atenção: a conta de extras do rateio já usava o overtimeValue quando maior que zero.
- **Decisão:** 08/10/2026 por Thomás Furtado
- **Onde no código:** `metrics/src/pages/hr/employees/employee-form-dialog.tsx`, `metrics-node/src/modules/hr/http/controllers/employees.ts`, `metrics-node/src/modules/hr/use-cases/payroll/calculate-extras.ts`

### Avisos do ponto só avisam (`regra-ponto-avisos`)
- **Regra:** O espelho e o resumo do mês mostram avisos: dia acima de 10 horas, intervalo menor que 1 hora, menos de 11 horas entre jornadas, batida incompleta e batida fora de ordem. Nenhum aviso bloqueia nem muda valor. Batida fora de ordem (ex.: saída para o intervalo 2 minutos antes da entrada) não entra na conta: o trecho com menos de 6 horas negativas é ignorado e avisado; com 6 horas ou mais, é tratado como virada da meia-noite.
- **Por que é assim:** CLT, art. 59 (limite de 2 horas extras), art. 71 (intervalo de 1 hora acima de 6 horas de trabalho) e art. 66 (11 horas entre jornadas). O sistema é sugestivo (D18). A batida fora de ordem virava cerca de 24 horas de trabalho no Marujo (07/09/2026). Fonte: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm.
- **Decisão:** 08/10/2026 por Lei (CLT) + Thomás Furtado (D18)
- **Onde no código:** `metrics-node/src/modules/hr/ponto/apuracao.ts`, `metrics-node/src/modules/hr/ponto/regra.ts`

## Trabalhos que rodam o tempo todo

### Equipe do PDV (usuários e funcionários) — Excessivo
- **Frequência:** a cada 5 min (sincronia geral do PDV), sempre a lista inteira
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/users?incluirFuncionarios=1`
- **Quantos:** 1 por loja
- **A cada vez:** A nuvem protege o PIN e uma senha aleatória de cada funcionário com bcrypt (feito em JavaScript puro, que é lento de propósito) a cada chamada: 2 cálculos por funcionário a cada 5 min, e o resultado muda toda vez.
- **Por que existe:** Login por PIN no PDV e no app do garçom, com o grupo de permissão do RH.
- **Proposta:** Usar o carimbo de mudança de usuários (já devolvido por /sync/status) ou 30 min; não recalcular quando nada mudou.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:186`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts:91`, `metrics-node/src/modules/pdv-sync/services/equipe-do-pdv.ts:98`

### Relógio de ponto: envio de batidas — Ok
- **Frequência:** a cada 30 s, só se houver batida não enviada
- **Onde roda:** Computador do Metrics.Ponto → `Nuvem: POST /hr/time-clock/sync-offline (normalmente nenhuma chamada)`
- **Por que existe:** Batida feita sem internet sobe quando a internet volta.
- **Onde no código:** `Metrics.Ponto/MainWindow.xaml.cs:205`

### Relógio de ponto: lista de funcionários — Ok
- **Frequência:** ao abrir e a cada 30 min
- **Onde roda:** Computador do Metrics.Ponto → `Nuvem: GET /hr/employees/sync`
- **Por que existe:** Funcionário novo pode bater o ponto sem reiniciar o relógio.
- **Onde no código:** `Metrics.Ponto/MainWindow.xaml.cs:207`

## Tabelas e Estrutura de Dados

### Funcionário (`employees`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Funcionário do RH: tipo (registrado, sem registro, horista, diarista), PIN do ponto, limite de compra a prazo e os valores: salary = salário mensal (ou o valor da hora do horista); dailyRate = a diária do diarista ou, para os outros, o valor da dobra; overtimeValue = o valor da hora extra combinado com a pessoa (0 = pela regra da loja). Pode estar ligado a um usuário do sistema.
- **Quem grava:** Web → RH → Funcionários (cadastro).

### Batida de ponto (`time_clocks`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Entrada, intervalo, saída e o trecho extra de um dia de trabalho, mais a dobra (isExtraDay + negotiatedValue) e a ausência (atestado, falta). O dia é o de competência: batida antes das 04:00 de Brasília conta para o dia anterior.
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
- **O que é:** Regra de hora extra da loja, com data de início (valid_from): divisor do salário, jornada do dia e da semana, tolerância, os percentuais (extra, 2ª faixa, domingo e feriado), o modo do domingo e do feriado, o adicional noturno e a hora reduzida, as horas padrão da diária e se o diarista recebe extra. model_key diz de onde veio (CLT, SP_BARES_RESTAURANTES, LITORAL_NORTE, PERSONALIZADO ou LEGADO = a conta antiga do espelho). Sem nenhuma linha, vale a CLT.
- **Quem grava:** Web → RH → Configurações → Regra de hora extra da loja; a migration 20261008100000 cria a LEGADO nas lojas que já usavam o ponto.
- **Quem lê:** A conta do ponto (src/modules/hr/ponto): espelho, resumo do mês e PDF.

### Feriado (`holidays`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Feriados usados no cálculo de horas.

### Grupo de funcionários (`employee_groups`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** O cargo virou cadastro (06/10/2026): cada grupo (garçom, caixa, cozinha...) diz se quem está nele entra no app do garçom e/ou no PDV com o PIN do ponto. Nasceu dos cargos que já existiam, um grupo por nome.
- **Quem grava:** Web → RH → Funcionários (lista de grupos no cadastro; grupo novo nasce do cargo digitado).
- **Quem lê:** App do garçom e PDV, na entrada pelo PIN; cadastro do funcionário.
- **Cresce:** Poucas linhas: uma por cargo da loja (5 a 15).

## Pendências e decisões

- Vale e consumo lançados no PDV usam usuário do sistema, não funcionário do RH (pergunta 4).
- Ponto: horários combinados (passo 3 da ESPEC do ponto) e o aviso de domingos de folga (D27, proposta). A regra das 3 lojas (Marujo 60%, Giardinetto 70%, Katatau 50%) entra sozinha no Sincronizar (migration 20261008100000).
