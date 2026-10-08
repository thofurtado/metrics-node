# ESPEC: regra de hora extra da loja e banco de horas (passos 1 e 2 do parecer de 07/10/2026)

Objetivo em uma frase: o próprio cliente configura, com explicação dentro do sistema, como a loja paga a hora extra (percentuais
da lei ou da convenção) e se as horas a mais viram dinheiro ou banco de horas, e o ponto calcula tudo numa conta só.

Base: `PARECER-PONTO-E-JORNADA-2026-10-07.md` (o que existe hoje, a lei e a convenção). Entrevista no método grill-me: uma
pergunta por vez; cada resposta entra aqui com a data e o porquê dito pelo Thomás.

---

## Decisões (respostas do Thomás em 07/10/2026)

| # | Decisão | O porquê (palavras dele) |
|---|---|---|
| D1 | Começar pelos **passos 1 e 2**: uma conta só no servidor e a regra da loja configurável, com data de vigência. | "sim começar pelos passos 1 e 2" |
| D2 | A loja que não configurar **passa para o padrão da CLT**: 50% no dia normal, 100% no domingo e no feriado sem folga compensatória, noturno de 20% com a hora noturna reduzida. Hoje é 60%, 100% e 7h20, sem noturno. | "passa para o padrão clt" |
| D3 | Ninguém precisa comprovar o enquadramento ao Metrics. **O sistema explica, na própria tela, qual opção escolher**, e o cliente configura sozinho. | "mais importante do que pedir para eles me comprovarem algo é explicar dentro do sistema qual opção ele deve escolher [...] o próprio cliente consegue configurar seu sistema" |
| D4 | O destino da hora extra é uma **configuração**: **pagar** ou **banco de horas**. Quem usa banco: todo mês as horas a mais (e a menos) vão para o banco; quando a pessoa recebe pelas horas ou folga, sai do banco. | "para entendermos se o cliente acumula banco de horas ou paga as horas extras [...] todos os meses poderíamos ajustar nesse banco de horas e conforme a pessoa receber pelas horas ou folgar tiramos desse banco" |
| D6 (B1) | **A loja escolhe o padrão (pagar ou banco) e dá para trocar por funcionário** no cadastro dele (ex.: o gerente recebe as extras, o salão fica no banco). | Escolheu a opção recomendada: configura uma vez e cobre as exceções. |
| D7 (B2) | **1 hora extra = 1 hora no banco** (a compensação da lei). Se não for compensada no prazo, é paga com o adicional da regra da loja. | Opção recomendada: é o que a lei prevê e é simples de explicar ao funcionário. |
| D8 (B3) | **O banco vira uma "conta corrente de horas", no futuro**: tudo o que a pessoa faz a mais acumula, separado por tipo (50%, 100%...); pagar X horas ou dar folga de X horas dá baixa de X horas; o que não for pago continua acumulando. Assim "pagar ou banco" deixa de ser uma escolha fixa. **Fica para quando existir o motor de pagamento** que bate com os descontos do contador. B4 a B7 (prazo, vencimento, saldo negativo, fechamento) ficam para essa etapa. | "sempre acumula e pagar deduz, se não pagar continua acumulando [...] mas enquanto nós não construirmos o motor de pagamento [...] aí não vai dar [...] não sei se está na hora de discutir isso" |
| D9 | **Escopo agora (passos 1 e 2)**: a regra da loja (CLT ou convenção, explicada na tela) e a conta certa das horas de cada mês **separadas por tipo** (normal, extra na 1ª faixa, extra na 2ª faixa, domingo e feriado, noturno), no espelho, no resumo do mês e no PDF. Os minutos ficam guardados por tipo, prontos para a futura conta corrente de horas. **D6 e D7 continuam valendo como direção**, mas sem tela nesta etapa. | Escolheu a opção recomendada: conta certa agora, saldo depois. |
| D10 (A1) | **Perguntas guiadas + modelos**: a tela começa com "Sua loja segue uma convenção coletiva?". Não sei / não: fica a CLT, com o porquê. Sim: modelos conhecidos (ex.: bares e restaurantes de SP, com o texto do enquadramento no Sindresbar) e o personalizado. Cada campo tem uma frase do que é e de onde achar na convenção. | Escolheu a opção recomendada. |
| D11 (A5) | **Antes de aplicar, avaliar o banco de cada um dos 3 clientes que usam o ponto (Katatau, Marujo e Giardinetto) e deixar a regra de cada um praticamente pronta**; depois só discutir os detalhes. | "atualmente os três clientes que utilizam o ponto são a katatau o marujo e a giardinetto, aí nós avaliamos os três e já deixamos algo praticamente pronto" |
| D12 | **Princípio: o sistema faz o certo por padrão (CLT ou convenção) e dá liberdade a quem trabalha fora do padrão** (o Marujo continua fazendo do jeito dele, com o "personalizado" e ajustes manuais). Hoje todas as regras do ponto nasceram do Marujo. | "hoje todas as regras criadas são baseadas no marujo que faz tudo errado, temos que preparar o sistema para fazer tudo isso certo, com a liberdade do marujo continuar fazendo do jeito que ele quer [...] os que são fora do padrão, temos que dar a liberdade deles manipularem as coisas do jeito que quiserem" |
| D13 | **Pensar cada tela afetada**: o resumo do mês muda (com a jornada da pessoa, no passo 3), uma aba nova de banco de horas (quando vier a conta corrente), espelho, PDF e Configurações do RH. | "é bom pensar cada tela que essas alterações vão ter que ajustar [...] vamos ter que construir uma nova aba para banco de horas" |
| D14 | **Diarista recebe a diária combinada**; nas configurações gerais do RH fica a **quantidade de horas padrão da diária** (ex.: 8h). O que passar disso é hora extra. | "para diarista paga-se o valor da diária combinada e nas configurações gerais deveria ter uma quantidade de horas padrão para esse tipo de combinado" |
| D15 | **Todo funcionário tem o campo "valor da hora extra"** (já existe no banco, `overtimeValue`, sem uso). A tela mostra o valor calculado pela regra (salário ou diária ÷ horas × adicional) e deixa trocar (liberdade da D12). | "a hora extra é um campo que todos devem ter" |
| D16 | **Um único campo de valor no cadastro**: salário mensal (registrado), valor da diária (diarista) ou valor da hora (horista), com o rótulo conforme o tipo. Proposta técnica: só a tela muda; os valores continuam nas colunas de hoje (`salary` e `dailyRate`), sem mexer nos dados das lojas. | "o diarista pode usar o mesmo campo que o salário que os outros usam para definir o valor da sua diária" |
| D17 | **Extra do diarista, cada caso no seu lugar**: horas além do padrão da diária = hora extra, que **soma** à diária; dia combinado por valor fechado (a "dobra", que o ponto já guarda) **substitui** a diária daquele dia. | Escolheu a opção recomendada. |
| D18 | **O sistema é sugestivo e nunca bloqueia.** Os fatos (batidas, horas trabalhadas, horas noturnas, horas acima da jornada) ficam sempre registrados como aconteceram; **o valor** segue a regra da loja, que liga e desliga cada adicional e escolhe os percentuais. Ao lado de cada campo, "o que a lei / a sua convenção pede"; escolha abaixo disso = aviso discreto, sem travar e sem alerta repetido. O que a loja não faz fica registrado como aviso, "cada um que faça o que bem entender". | "eu não queria forçar eles a nada, queria que conseguissem operar sempre sem bloqueios, o sistema é para ser sugestivo [...] dando a confiança de que estamos fazendo o correto e o que não estivermos fazendo estamos cientes, mas só como aviso [...] nem exagerado" |
| D19 | **As 3 lojas de hoje começam com a regra que já usam** (substitui a D2 para elas; a CLT continua como padrão da loja nova). O Thomás ajuda a configurar, sem dar trabalho aos clientes. Hora extra normal: **Marujo 60%** ("acho que está errado, mas deixe assim"), **Giardinetto 70%** ("acho que estão corretos"), **Katatau 50%**. **Domingo e feriado: quando for hora extra, 100% para todos.** A confirmar na configuração com ele: jornada do dia (hoje o espelho usa 7h20), noturno (Marujo não paga) e extra dos diaristas do Marujo (ele acha que o Marujo não paga). | "eu não quero dar trabalho para meus clientes, o marujo usa na hora extra normal 60% [...] o giardinetto utiliza 70% [...] a katatau utiliza 50% [...] domingo e feriado quando for hora extra é 100% para todos, mas vou precisar que me ajude a configurar tudo isso" |
| D20 | **Tela nova de "horários combinados" (passo 3) entra no plano.** Requisitos dele: <br>- um **modelo de horário** aceito por vários funcionários (começa tal hora, vai até tal hora, almoço de tanto tempo começando tal hora...); <br>- fácil de cadastrar **individual ou em grupo** e fácil de **ajustar por funcionário**; <br>- **sem gerar dados desnecessários** no sistema; <br>- sem quebrar nada. | "uma tela que facilite e pode gerar um padrão que pode ser aceito por mais de um funcionário [...] que não gere muitos dados desnecessários [...] fácil de cadastrar ou individual ou em grupo e bom de ajustar por funcionário, sem quebrar nada" |
| D21 | **Aviso de domingos das mulheres** (CLT, art. 386: revezamento quinzenal que favoreça o domingo de folga): aparece como aviso, **não obriga e não exagera**. Hoje nenhuma das 3 lojas dá 2 domingos no mês às mulheres. Precisa de um campo no cadastro do funcionário para saber a quem o aviso se aplica. | "nenhum dos 3 dá 2 domingos por mês para as mulheres, isso vai ser avisado, mas não obrigado, e nem exagerado" |
| D5 | Fazer a entrevista (este documento) antes de construir. Depois dos passos 1 e 2, outra entrevista para o passo 3 (horário de trabalho). | "ok podemos fazer essa entrevista" |

### Sobre a D4: é plausível? Sim, é o modelo da lei
- CLT, art. 59 (texto conferido no Planalto em 07/10/2026):
  - § 2º: a hora a mais pode ser compensada com menos horas em outro dia, sem o adicional, em até **1 ano**, por convenção ou
    acordo coletivo, sem passar de 10 horas no dia;
  - § 5º: por **acordo individual escrito**, o prazo é de até **6 meses**;
  - § 6º: compensar **dentro do mesmo mês** vale até com acordo individual, escrito ou não;
  - § 3º: na rescisão, as horas não compensadas são pagas como hora extra;
  - art. 59-B: se faltar algum requisito da compensação, mas a semana não passar da duração máxima, deve-se só o adicional
    (e não a hora inteira de novo).
- A convenção dos bares e restaurantes de SP (2025 a 2027) permite banco de até 1 ano e saldo negativo de até 30 horas para as
  empresas cadastradas.
- O que é irregular, e é comum: banco **sem** nenhum acordo, saldo que passa do prazo e não é pago com o adicional, e hora
  extra todo dia acima de 2 horas. Pagar a hora extra é o caminho normal e legal. **O sistema registra o que a loja faz, explica a
  regra e avisa quando algo fica fora dela (prazo vencendo, saldo acima do limite); ele não proíbe.**

---

## Situação das perguntas

- **Banco de horas (B1 a B7)**: B1 = D6, B2 = D7, B3 = D8. B4 a B7 (prazo, vencimento, saldo negativo, saída e fechamento)
  ficam para a etapa do motor de pagamento (D8).
- **Regra da loja (A1 a A5)**: A1 = D10, A5 = D11. A2, A3 e A4 decididos pela lei, abaixo.
- **Diarista**: D14 a D17.

### Decidido pela lei (sem pergunta)
- **A3. Dia e semana**: é extra o que passar da **8ª hora do dia** ou da **44ª da semana** (CF, art. 7º, XIII; CLT, art. 58). As
  duas contas valem juntas, sem contar a mesma hora duas vezes: primeiro o dia, depois o que sobrar acima de 44h na semana. A loja
  pode mudar os dois números (ex.: jornada de 7h20 em 6x1).
- **A4. Adicional noturno**: entra já. CLT, art. 73: das 22h às 5h, pelo menos 20%, com a hora noturna de 52min30s. A convenção
  pode pedir mais (a loja ajusta).
- **A2. Segunda faixa**: campo opcional, desligado de fábrica ("a partir da 3ª hora extra do dia, X%"). Existe em convenções e
  custa pouco ter.
- **Tolerância**: 10 minutos no dia (CLT, art. 58, § 1º); passou disso, conta tudo. É a regra que o ponto já usa.
- **Divisor**: 220 (44h semanais), editável.
- **Meses passados**: a regra nova vale a partir da data em que entra. Os meses de antes continuam com a conta que a loja já viu
  (60%, 7h20), registrada como a primeira regra de cada loja.

---

## Os 3 clientes que usam o ponto (consulta só de leitura, números agregados, 07/10/2026)

Os três estão no **Litoral Norte**: Marujo e Giardinetto em Caraguatatuba, Katatau em São Sebastião. **A convenção de SP dos
50%/70% (Sindresbar) não vale lá**: ela cobre a capital e 21 municípios da Grande SP. Vale a **convenção 2025/2027 do SinHoRes
Litoral Norte com o SECHSAR** (Ubatuba, Caraguatatuba, São Sebastião e Ilhabela). As circulares do sindicato (lidas) dizem que a
empresa do Simples que adere ao **REPIS** tem:
- piso menor;
- banco de horas por adesão de até 12 meses;
- intervalo de 30 minutos até 4 horas;
- 12x36 combinada direto com o funcionário;
- controle de jornada alternativo para empresas com até 10 empregados.

**O percentual da hora extra e do noturno não está nas circulares**: está na convenção inteira (PDF de 30 MB, ainda não lido).

| | Marujo | Giardinetto | Katatau |
|---|---|---|---|
| Funcionários ativos | 29: **17 diaristas** (sem salário), 8 registrados, 4 sem registro | 9 registrados | 9 (6 registrados, 3 sem registro) |
| Usam o ponto desde | março/2026 (200 a 300 dias por mês) | setembro/2026 (9 pessoas) | julho/2026, pouco (1 a 3 pessoas) |
| Regra de hora extra gravada | nenhuma (o servidor dá extra zero; a tela estima 60%) | nenhuma | nenhuma |
| Horas por dia (mediana / 90% dos dias até) | 7h09 / 10h30 | 7h39 / 9h15 | 7h32 / 9h00 |
| Dias acima de 8h (+ tolerância) | 26% | 40% | 29% |
| Dias acima de 10h (passa do limite da lei) | **12,6%** (4,7% acima de 12h) | 3,7% | 1,5% |
| Semanas acima de 44h | 16% | 14% | 25% |
| Dias por semana (média) | 4,0 (muitos diaristas) | 4,3 (o normal é 5) | 4,3 |
| Domingos | 18% dos dias; 2,3 domingos por pessoa no mês | 9%; 1,8 por pessoa | 9%; 1,6 por pessoa |
| Trabalho entre 22h e 5h | **65% dos dias**, cerca de 1h40 por dia | 52% dos dias, cerca de 43 min | nenhum |
| Intervalo menor que 1h (dias acima de 6h) | 44% | 43% | 37% |
| Feriados cadastrados | 42 (2024 a 2026) | 14 | 13 |

O que isso muda:
- **Marujo**:
  - o noturno é o maior impacto em dinheiro (65% dos dias);
  - a hora extra dos 17 diaristas hoje dá zero (D14 a D16 resolvem);
  - 1 dia em cada 8 passa de 10 horas (o sistema deve avisar);
  - intervalo abaixo de 1h só é permitido para quem aderiu ao REPIS.
- **Giardinetto**: o noturno também aparece; 40% dos dias passam de 8h.
- **Katatau**: turno de dia e uso pequeno do ponto. A regra muda pouco.

Proposta de regra inicial dos três (D11): **CLT** (D2) até a convenção do Litoral Norte ser lida. Depois, um modelo "Hotéis,
bares e restaurantes do Litoral Norte (SinHoRes x SECHSAR)", com a pergunta "sua empresa aderiu ao REPIS?" e os números da
convenção. O Marujo pode ficar no "personalizado" (D12) se quiser manter o jeito dele.

---

## Resumo para aprovação

**Será feito (passos 1 e 2):**
1. Uma conta só no servidor (horas, extra pelo dia e pela semana, 2ª faixa opcional, domingo, feriado, noturno com hora reduzida,
   tolerância), usada pelo espelho, pelo resumo do mês, pelo PDF e pela folha. Testes automáticos com casos reais, inclusive os
   padrões dos três clientes. Corrige a segunda-feira tratada como domingo.
2. Tela "Regra de hora extra" no RH > Configurações, com perguntas guiadas e modelos (D10): CLT (padrão, D2), bares e restaurantes
   de SP (Sindresbar), Litoral Norte (SinHoRes x SECHSAR, depois de lida a convenção) e personalizado. Com data de vigência;
   meses passados preservados. Aviso nas telas do ponto até a loja confirmar a regra.
3. Horas padrão da diária (D14), campo único de valor no cadastro (D16) e valor da hora extra de cada funcionário com o
   calculado à vista e troca livre (D15). Extra do diarista soma; dobra substitui (D17).
4. Espelho, resumo do mês e PDF mostrando as horas por tipo (normal, extra 1ª faixa, extra 2ª faixa, domingo e feriado,
   noturno), com os percentuais da regra (sai o "60%" fixo).
5. Avisos: dia acima de 10 horas; intervalo menor que 1 hora (permitido só com a adesão ao REPIS ou à convenção que o preveja).

**Não será feito agora:** horário de trabalho por funcionário (passo 3, com entrevista própria), conta corrente/banco de horas
(D8), hora extra entrando sozinha na folha (depende do motor de pagamento), arquivos da Portaria 671 (passo 4).

**Riscos:**
- os números do espelho mudam nas três lojas (de 60%/7h20 para CLT, mais o noturno);
- a nuvem e a web vão juntas (a tela nova depende do servidor novo);
- o cálculo da folha não muda nesta etapa.

**Ordem de publicação:** nuvem (servidor) primeiro, depois a web; nenhuma migration destrutiva (a tabela de regras já existe; as
colunas novas são acrescentadas com IF NOT EXISTS).

---

## Simulação: setembro/2026 nas 3 lojas, conta de hoje x conta nova (padrão CLT)

Consulta só de leitura, totais da loja. "Hoje" = a conta do espelho da web (7h20 por dia, 60%, domingo com o excedente a 100%,
feriado o dia todo a 100%; diarista sem salário = R$ 0). "Nova" = CLT (8h por dia e 44h por semana, 50%, domingo e feriado como
hoje, noturno de 20% com a hora de 52min30s; diarista com a hora = diária ÷ 8). Dobras fora das duas. Valores são estimativas do
que o espelho mostra; a folha não muda nesta etapa.

| | Marujo | Giardinetto | Katatau |
|---|---|---|---|
| Pessoas que bateram ponto / horas trabalhadas | 18 / 1.789 h | 8 / 1.207 h | 2 / 305 h |
| **Hoje**: horas extras a 60% / a 100% | 143,6 h / 103,9 h | 106,5 h / 60,2 h | 21,7 h / 13,8 h |
| **Hoje**: valor das extras | R$ 3.793 (diaristas: R$ 0) | R$ 3.012 | R$ 567 |
| **Nova**: extras a 50% (pelo dia + pela semana) / a 100% | 106,3 + 5,9 h / 93,2 h | 59,4 + 2,4 h / 56,9 h | 9,6 + 9,7 h / 13,6 h |
| **Nova**: horas entre 22h e 5h (relógio) | 228,5 h | 56,3 h | 0 |
| **Nova**: valor das extras + noturno | R$ 4.449 + R$ 561 = **R$ 5.010** (R$ 1.651 dos diaristas) | R$ 2.154 + R$ 135 = **R$ 2.289** | **R$ 510** |

Leitura:
- **Marujo sobe**, porque os diaristas passam a ter hora extra e entra o noturno.
- **Giardinetto e Katatau descem**, porque a extra começa depois de 8h e não de 7h20, e o adicional cai de 60% para 50%.
- Risco: se a convenção do Litoral Norte pagar mais que a CLT, o padrão CLT mostra menos do que a loja deve. Por isso o modelo
  "Litoral Norte" deve estar pronto antes de a versão chegar às três lojas (D11).
