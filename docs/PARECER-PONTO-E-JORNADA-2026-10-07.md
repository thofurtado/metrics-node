# Parecer: hora extra de 50% e 70% e o "horário de trabalho" de cada funcionário

Data: 07/10/2026. Pedido do Thomás: "como podemos aplicar isso no nosso sistema [...] existe uma ideia de cadastrar cada horário
do funcionário [...] quase todo programa de ponto trabalha assim e eu não sei por quê; não queria mudar muito nosso sistema para
não quebrar o que já funciona, mas na hora em que fazemos para mais gente precisa de mais padrão".

Base deste parecer: (1) a pesquisa do Antigravity de 06/10/2026 (conversa `488d1382…`, arquivo `pesquisa_clt_ponto_metrics.md`);
(2) leitura do código do ponto hoje (metrics-node, web e Metrics.Ponto); (3) a CLT, a Portaria 671 e a convenção de bares e
restaurantes de SP, com os links no fim. **Nada foi mudado no sistema.** O banco da nuvem não respondeu na hora da conferência
(tempo esgotado), então não sei se alguma loja tem a regra de hora extra preenchida (tabela `hr_rule_histories`).

---

## 1. A resposta curta

1. **O nome do que você lembrou é "horário contratual"** (também chamado de jornada, escala ou horário de trabalho): o
   combinado com o funcionário, ou seja, a hora de entrar, a de sair, o intervalo e os dias de folga. As batidas são o que
   aconteceu; o horário contratual é o que devia acontecer. O programa de ponto calcula a diferença entre os dois.
2. **Por que todo programa de ponto trabalha assim:**
   - **A lei pede.** A Portaria 671/2021 manda o espelho de ponto mostrar o "horário e jornada contratual" do empregado
     (art. 84) e o arquivo que vai para a fiscalização (AEJ) tem um registro só para o horário contratual (registro tipo 04).
   - **Sem o combinado, o sistema não sabe o que é atraso, falta, folga ou hora extra.** Hoje o Metrics chama de "FOLGA"
     qualquer dia sem batida e trata como extra tudo o que passa de 7h20 no dia, para todos os funcionários iguais.
3. **Os seus 50% e 70% vêm da convenção dos bares e restaurantes de SP (Sindresbar com Sinthoresp, 2025 a 2027).** A empresa que se
   cadastra no sindicato patronal nas "condições especiais" ou nas "condições diferenciadas" paga a hora extra com **50% ou 70%,
   conforme o caso**, e o adicional noturno com **20% ou 35%**. Ou seja: o percentual é uma regra **da empresa** (de cada loja),
   não de cada funcionário.
4. **Meu parecer: vale a pena adotar o horário de trabalho**, mas como uma camada **opcional** por cima do que já existe. Quem
   não cadastrar horário continua exatamente como hoje. **Antes disso, porém, é preciso juntar a conta da hora extra**, que hoje
   está feita em 4 lugares com números diferentes, e trocar o 60% fixo por uma regra configurável por loja.

---

## 2. Como o ponto do Metrics funciona hoje

| Assunto | Como está |
|---|---|
| Batidas | Uma linha por funcionário por dia, com 6 batidas fixas: entrada, saída e volta do intervalo, saída, e entrada e saída da "extra". O dia vira às 04:00. |
| Horário de cada funcionário | **Não existe.** Nem no funcionário, nem no grupo. |
| Jornada normal | Uma só para a loja inteira: **7h20 por dia fixo na tela** (que dá 44 horas em 6 dias) e **8h20 no servidor** (padrão da tabela de regras). |
| Hora extra | **60%** em dia normal; **100%** no domingo (só o que passou da jornada) e no feriado (o dia inteiro); tolerância de 10 min. **Não existe 50% nem 70%.** O 60% não tem fonte: a pesquisa do Antigravity também não achou. |
| Onde a conta é feita | **Em 4 lugares, com números diferentes**: espelho (7h20, 60%/100%), resumo do mês (7h20, sem tolerância, sempre 60%), servidor (8h20 e uma regra que nenhuma tela preenche: sem ela, a extra dá zero), folha (não usa hora extra; os "extras" do rateio entram sem adicional). |
| O que não existe | Adicional noturno, banco de horas, limite de 2 horas extras por dia, conta pela semana (44h), atraso, intervalo mínimo, 11h entre jornadas, arquivo AFD/AEJ. |
| Ajuste do gerente | Edita a batida em cima da original (a original se perde). |
| O que anunciamos | A Central de Downloads diz "Portaria 671" e o SaaS Admin diz "espelho de ponto biométrico" e "cálculo de hora extra automático". O sistema ainda não cumpre isso. |

---

## 3. O que diz a lei e a convenção

**CLT** (texto aberto no site do Planalto em 07/10/2026):
- Art. 59: até **2 horas extras por dia**; a hora extra vale **pelo menos 50%** a mais que a normal.
- Art. 66: **11 horas** de descanso entre uma jornada e a seguinte.
- Art. 73: trabalho noturno, **das 22h às 5h**, com **pelo menos 20%** a mais; a hora noturna conta como **52 minutos e 30 segundos**.
- Art. 74, § 2º: acima de **20 trabalhadores** no estabelecimento, anotar entrada e saída é obrigatório; o intervalo pode vir
  pré-assinalado.
- Art. 386: havendo trabalho aos domingos, a escala das mulheres deve ser de revezamento quinzenal que favoreça o domingo de folga.
  Está em vigor (as medidas provisórias de 2019 e 2020 que o revogavam perderam a validade). A pesquisa do Antigravity propôs
  automatizar isso pelo gênero; antes disso, precisa de conferência jurídica (ver a seção 7).
- Também valem (não abri a fonte hoje): tolerância de até 5 minutos por marcação e 10 por dia (art. 58, § 1º); intervalo de 1h
  para jornada acima de 6h (art. 71); domingo e feriado trabalhados sem folga compensatória pagos em dobro (Lei 605/1949, art.
  9º; Súmula 146 do TST).

**Portaria 671/2021** (cópia integral consultada; o site do Diário Oficial não abriu):
- Art. 84: o espelho de ponto deve ter, no mínimo, identificação da empresa e do trabalhador, o período, **"horário e jornada
  contratual"**, as marcações feitas e as tratadas, e a duração das jornadas (com a hora noturna reduzida).
- Art. 74: é proibido o sistema marcar o ponto sozinho "com base no horário contratual". O combinado serve de referência, nunca
  para preencher batida.
- O programa que trata o ponto gera o espelho e o AEJ. No AEJ, o registro tipo 04 é o horário contratual (com a jornada diária
  em minutos).

**Convenção dos bares e restaurantes de SP, 2025 a 2027** (informativo do Sindresbar e da CNTur de 12/05/2025):
- Vale de 01/07/2025 a 30/06/2027, na capital e em 21 municípios. **Não vale** para fast food da capital, que tem a convenção do
  Sindifast, nem para hotéis.
- **Condições especiais**: a empresa comprova uma contrapartida (plano de saúde pago pela empresa, ou gorjeta repassada em folha,
  ou o convênio da Cesta Social).
- **Condições diferenciadas**: ClubSaúde/Saúde da Gente **e** estimativa de gorjeta integrada à folha.
- O cadastro é por estabelecimento (matriz e cada filial), renovado em prazos fixos (28/02/2026 e 15/01/2027).
- Quem é enquadrado pode:
  - pagar hora extra com **50% ou 70%** e o noturno com **20% ou 35%**, "conforme o caso";
  - usar a escala 12x36;
  - ter banco de horas de até 1 ano;
  - pré-assinalar o intervalo;
  - marcar cargos de confiança, que ficam sem hora extra e sem noturno.
- Regras que valem para os enquadrados:
  - banco de horas negativo de até 30 horas;
  - intervalo de 30 minutos a 4 horas para a empresa com os "regramentos específicos" (mais de uma contrapartida, ou sugestão de
    gorjeta de 12% ou mais);
  - gorjeta fora da base da hora extra (Súmula 354 do TST).
- **Para o horista**, conta como extra o que passar da **8ª hora do dia ou da 44ª da semana**, qualquer que seja a escala.
- **O que o informativo NÃO diz:** qual dos dois enquadramentos paga 50% e qual paga 70%, e quanto paga a empresa que não se
  cadastrou. A convenção inteira (PDF escaneado de mais de 10 MB) não abriu aqui. Na busca apareceu um trecho da convenção
  anterior (2023 a 2025) indicando 70%/35% para as "diferenciadas". Isso não foi confirmado.

**Fast food da capital (Sindifast):** a convenção 2025 a 2027 existe (circular de fevereiro de 2026), mas não consegui abrir a
cláusula de hora extra. O "70% do Sindifast" da pesquisa do Antigravity veio de uma fonte fraca.

---

## 4. O parecer: um caminho em 4 passos, sem quebrar o que funciona

**Regra de ouro:** loja que não configurar nada continua com os mesmos números de hoje. Toda mudança vale **a partir de uma data**
(nunca recalcula o passado).

### Passo 1: uma conta só (a base de tudo)
- Uma única função no servidor calcula horas, hora extra e domingo/feriado. O espelho, o resumo do mês, o PDF e a folha passam a
  ler essa conta (hoje cada um faz a sua, com números diferentes).
- Testes automáticos com casos reais (6x1, domingo, feriado, virada da meia-noite, tolerância).
- Sem isso, qualquer regra nova daria 4 respostas diferentes.

### Passo 2: a "regra da loja" (convenção), configurável e com data
- Uma tela em RH > Configurações, gravando na tabela que já existe (`hr_rule_histories`), com modelos prontos que a loja pode
  ajustar:
  - **CLT (mínimo da lei)**: 50% / domingo e feriado 100% / noturno 20%;
  - **Bares e restaurantes SP: condições especiais**;
  - **Bares e restaurantes SP: condições diferenciadas**;
  - **Personalizado**.
- Campos:
  - % da hora extra no dia normal e, se a convenção pedir, uma segunda faixa (ex.: 50% nas 2 primeiras, 70% depois; há convenções
    assim);
  - % de domingo e feriado;
  - % e horário do noturno, com ou sem hora reduzida;
  - jornada do dia e da semana (8h e 44h);
  - se a extra conta pelo dia, pela semana ou pelos dois;
  - tolerância e divisor (220).
- Valor inicial de quem já usa: **exatamente o de hoje** (60%, 100%, 7h20, 10 min). Nada muda até a loja escolher.
- Os textos fixos "60%" saem das telas e do PDF; aparece o percentual configurado.

### Passo 3: o "horário de trabalho" (horário contratual), opcional
- **Modelos de horário reaproveitáveis**, porque um restaurante tem poucos turnos diferentes. Exemplos: "Salão noite 6x1:
  18h às 02h, intervalo 1h, folga na segunda"; "Cozinha almoço 5x2"; "12x36".
- Cada funcionário aponta para um modelo, com data de início. **Sem modelo, ele continua como hoje.**
- Com o modelo, o sistema passa a saber:
  - atraso e saída antes da hora;
  - falta x folga de verdade (hoje todo dia sem batida vira "FOLGA");
  - a hora extra pelo combinado do dia;
  - os domingos de folga, com um aviso de escala quando alguém está trabalhando domingos demais;
  - e o espelho passa a mostrar o horário contratual, como a Portaria 671 pede.

### Passo 4: quando o Metrics for vendido como ponto oficial (lojas com mais de 20 funcionários)
- Banco de horas (a convenção de SP permite até 1 ano e negativo de até 30h) e adicional noturno no cálculo.
- **Guardar a batida original** e o ajuste do gerente separados, com motivo e quem ajustou (hoje o ajuste apaga a original).
- Arquivo AEJ para a fiscalização e a decisão de transformar o Metrics.Ponto num ponto por programa nos moldes da Portaria 671
  (comprovante da marcação, registro do programa no INPI, AFD).
- **Até lá, corrigir os anúncios** "Portaria 671", "biométrico" e "hora extra automática".

Ordem recomendada: passos 1 e 2 juntos (pequenos, sem mudar a vida de ninguém), depois o 3 com uma entrevista antes, e o 4 quando
houver cliente que precise.

---

## 5. O que ficou de fora de propósito

- **Domingos das mulheres pelo gênero (art. 386):** a regra está em vigor, mas a pesquisa do Antigravity citou o tema errado do STF
  e não abriu a fonte. Gravar o gênero do funcionário também é dado pessoal. Recomendo: depois do passo 3, um aviso de escala
  "trabalhou X domingos seguidos", **sem** regra automática por gênero até haver conferência jurídica.
- **Escolher a convenção pela cidade ou pelo CNPJ:** o enquadramento depende do cadastro da empresa no sindicato patronal. Quem
  informa é a loja (ou o contador). O sistema só aplica.

---

## 6. Defeitos achados na leitura do código (não mexi em nada)

1. **Batida que o celular ou o PC guardou sem internet pode se perder:** o app de ponto marca tudo como enviado mesmo quando o
   servidor recusa uma batida.
2. **No servidor, a segunda-feira é tratada como domingo** na conta da hora extra. Só faz efeito se a loja tiver a regra
   preenchida no banco.
3. **A folha inclui funcionários inativos** (sem filtro de ativo).
4. O ajuste do gerente apaga a batida original (ver o passo 4).
5. A chave do quiosque de ponto está fixa no código, e o PIN fica guardado sem proteção.
6. O Atlas do RH diz que o dia vira às 07:00; o código vira às 04:00.

---

## 7. Decisões que dependem do Thomás

1. **Aprovar o caminho em 4 passos.** Recomendo começar pelos passos 1 e 2 juntos.
2. **Loja que não configurar:** manter os números de hoje (60%, 100%, 7h20) ou passar para o mínimo da CLT (50%)?
   Recomendo manter os de hoje: ninguém leva susto no fim do mês, e cada loja escolhe o seu modelo.
3. **Enquadramento de cada cliente** (Marujo, Katatau, Giardinetto): quem confirma é a loja ou o contador. Vale pedir a cada um
   o comprovante de cadastro no Sindresbar (ou dizer que não tem), e a cópia da convenção da cidade se for fora de SP.
4. **A hora extra deve entrar na folha sozinha?** Hoje não entra; as "dobras" e extras são pagas pelo rateio, sem adicional.
5. **Antes do passo 3**, uma entrevista curta sobre escalas (turnos de cada loja, folgas, 12x36, domingos).

---

## Fontes (consultadas em 07/10/2026)

- CLT, site do Planalto: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm (arts. 59, 66, 73, 74 § 2º e 386 lidos)
- Portaria MTP 671/2021, cópia integral: https://www.normaslegais.com.br/legislacao/portaria-mtp-671-2021.htm (arts. 74, 83, 84 e 93)
- Perguntas e respostas do MTP sobre a Portaria 671 (AEJ, registro 04, REP-P): https://www.guiatrabalhista.com.br/tematicas/portaria-671-2021-perguntas-e-respostas.htm
- Informativo da CCT 2025/2027 Sinthoresp x Sindresbar (12/05/2025): https://anrbrasil.org.br/wp-content/uploads/2025/07/INFORMATIVO-CCT-SINTHORESP-2025-2027-DATA-BASE-JULHO-DE-2025.pdf
- Notícia do Sinthoresp sobre a nova convenção, com o link do PDF integral: https://sinthoresp.com.br/site/nova-convencao-assinada-entenda-o-que-muda-para-quem-trabalha-em-bares-e-restaurantes/
- Circular de reajuste 2026 do Sindifast (vista na busca, não aberta; cita a CCT 2025/2027): https://sindifastfood.org.br/wp-content/uploads/2026/02/CIRCULAR-REAJUSTE-2026.pdf

*Conteúdo de apoio produzido com inteligência artificial em 07/10/2026. Não substitui a orientação do contador ou do advogado.
Antes de qualquer regra virar cálculo de pagamento, a convenção de cada loja deve ser conferida no texto integral.*
