# Especificação e Árvore de Decisão — Manual do Metrics

> **Status:** Fase 1 — Entrevista em andamento (Skill `grill-me`).
> **Data de início:** 29/09/2026.
> **Objetivo:** Criar um lugar único, legível por leigos (diretores, equipe, clientes) e por agentes de IA (Claude, Antigravity), que explique **para que serve cada parte**, **as regras com o PORQUÊ**, as **funções de negócio** (com entradas, saídas e motivo), e as **tabelas com suas relações**. Com isso, viabilizar a detecção contínua do que sobra (tabela/campo sem uso) e do que falta (função/regra sem motivo).

---

## 1. Origem e Problema Central
Hoje o código expressa *o que* o sistema faz, mas quase nunca *por quê*.
- **Caso real (29/09/2026):** No relatório de conferência de caixa, o "total de caixinhas" somou o valor integral das vendas que continham caixinha, em vez de somar apenas o excedente pago (ex.: conta de R$ 182,00 paga com R$ 200,00 = R$ 18,00 de caixinha). A caixinha vira crédito do funcionário e não sai fisicamente da gaveta no fechamento. A falta da regra documentada com seu *porquê* causou o bug silencioso.
- **Solução:** Manual do Metrics integrado ao SaaS Admin e aos repositórios, com verificação automatizada de consistência e regra viva.

---

## 2. Árvore de Decisões e Ramos da Entrevista

### Ramo 1: Nome da Aba, Audiência e Visibilidade [DECIDIDO em 29/09/2026]
- **Decisão tomada pelo Thomás:**
  - Nome oficial da aba: **"Manual"**.
  - Estrutura: Terá **duas visões** selecionáveis:
    1. **Visão de Negócio:** Para leitura leiga, entendimento de regras, porquês e processos.
    2. **Visão Técnica:** Para o Thomás, desenvolvedores e agentes (tabelas, diagramas, campos, integrações).
  - **Localização inicial:** Construído dentro do **SaaS Admin** (`metrics-saas-admin`), voltado para o Thomás, a equipe interna e os agentes (Claude, Antigravity).
  - **Risco Registrado e Segurança:** O SaaS Admin é um painel interno e **hoje não possui autenticação/login no código**. Portanto, **nenhum cliente final acessará o SaaS Admin**.
  - **Fase Futura (Cliente Final):** A versão voltada aos clientes finais dos restaurantes fica para um segundo momento, sendo incorporada diretamente no sistema web principal (`metrics`), onde os clientes já possuem login, e exibirá exclusivamente a Visão de Negócio.

### Ramo 2: Módulo Piloto Inicial
- **Recomendação:** Iniciar pelo módulo **Caixa e Vendas** (`caixa-vendas`), pois mexe diretamente com dinheiro, conferência e fluxo de fechamento.

### Ramo 3: Registro e Manutenção dos "Porquês"
- **Opções:**
  1. Conversacional: Thomás responde ao agente na sessão, o agente atualiza o manual e os JSONs no commit.
  2. Formulário no Admin: interface no próprio SaaS Admin com botão de adicionar/editar porquê, gravando no backend.
  3. Híbrido: formulário no Admin para anotações rápidas e manutenção via agente com commit versionado.

### Ramo 4: Catálogo de Funções de Negócio Iniciais
Proposta inicial por módulo para refinamento com o Thomás:
- **Caixa e Vendas:**
  - `CalcularCaixinhaDoTurno`: extrai o excedente de cada pagamento e taxas de serviço.
  - `AbrirTurnoCaixa`: inicia expediente com fundo de troco fixado.
  - `FecharTurnoCaixa`: confronta esperado do sistema com valores contados pelo operador.
  - `RealizarSangria`: retirada de dinheiro físico (despesa, recolhimento de sócio ou vale de funcionário).
  - `RealizarSuprimento`: aporte de dinheiro na gaveta.
  - `DividirConta`: rateio do total entre N pagantes/formas de pagamento.
  - `RegistrarConsumoFuncionario`: lançamento na conta corrente de funcionário para desconto em folha.
- **Fiscal:**
  - `EmitirNFCe`: geração de XML, assinatura e envio SEFAZ com regras tributárias (NCM/CST/IBS).
  - `EntrarEmContingenciaOffline`: emissão sem internet e fila de transmissão posterior.
- **Estoque:**
  - `EntradaNotaFiscalFornecedor`: leitura do XML da NF-e, De-Para de itens e cálculo de CMP.
  - `BaixaEstoquePorFichaTecnica`: dedução dos insumos proporcionais aos itens vendidos.
- **Mesas / Salão:**
  - `AbrirMesaComanda`: vinculação de clientes a uma mesa física.
  - `TransferirItensMesa`: movimentação entre comandas/mesas.
  - `LiberarMesa`: encerramento após conferência de pagamento total.

### Ramo 5: Glossário de Termos do Negócio (Proposta Inicial)
1. **Caixinha / Gorjeta:** Excedente voluntário pago pelo cliente além do total da conta (ex.: conta R$ 182,00 paga como R$ 200,00 = R$ 18,00). Fica retida no restaurante como crédito de funcionário para acerto futuro.
2. **Couvert Artístico:** Taxa pelo serviço de música/entretenimento ao vivo. Entra no caixa na forma paga e só vira despesa quando repassada ao artista.
3. **Serviço (10%):** Percentual facultativo sugerido sobre o consumo em atendimento de salão/mesas.
4. **Dia Operacional:** Expediente de faturamento que vira às 05:00 da manhã (para abarcar turnos noturnos/madrugadas sem fragmentar caixas em duas datas civis).
5. **Sangria:** Saída de dinheiro físico da gaveta do caixa durante o expediente.
6. **Suprimento:** Entrada de dinheiro na gaveta para recomposição de troco ou caixa.
7. **Conta da Casa / Consumo Interno:** Venda sem recebimento em dinheiro/cartão, debitada para sócios, funcionários ou permuta comercial.
8. **Contingência Offline:** Modalidade de emissão de documento fiscal (NFC-e) quando o PDV está sem conexão com a SEFAZ.
9. **Comanda / Mesa Ociosa:** Mesa aberta sem lançamento de novos itens por período prolongado.

---

## 3. Estrutura Técnica de Dados (Modulos JSON)
Cada arquivo em `metrics-node/docs/atlas/modulos/<id>.json` receberá:
- `paraQueServe`: Texto claro em linguagem de negócio (para leigo).
- `regras`: Lista de objetos `[{ id, titulo, regra, porque, data, decididoPor, ondeNoCodigo[] }]`.
- `funcoes`: Lista de objetos `[{ nome, oQueFaz, entradas[], saidas[], motivo, ondeNoCodigo[], usadaPor[], tabelas[] }]`.
- `glossario.json`: Lista de termos `[{ termo, significado, exemplo, modulos[] }]`.

---

## 4. O Verificador Automatizado ("O que sobra e o que falta")
Script `atlas.py verificar-manual` que reportará:
1. Funções de negócio no código sem entrada no manual.
2. Regras documentadas sem a explicação do "porquê".
3. Tabelas existentes no banco que ninguém grava ou lê (código morto ou sobra de schema).
4. Campos em tabelas que nunca são lidos em nenhuma query.
5. Termos técnicos ou de negócio citados em regras que estão ausentes do glossário.

---

## 5. Histórico de Decisões Tomadas
- `[29/09/2026]` **Caixinha / Gorjeta corrigida na causa (Fase 0):** Implementada a regra do excedente estrito em `src/utils/cashier/caixinha.ts`, eliminando a soma indevida do valor da venda. Testes automatizados aprovados (5 testes) e build com sucesso (v2.6.21.6 local).
