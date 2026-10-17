# Caixa e vendas

> Gerado por `atlas.py` em 17/10/2026 a partir do código e de `modulos/caixa-vendas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

O módulo de Caixa e Vendas é o núcleo financeiro e operacional do restaurante. Ele controla todo o fluxo de dinheiro que entra e sai do estabelecimento: a abertura do turno com o fundo de troco na gaveta, os registros de pagamentos dos clientes em todas as modalidades (dinheiro, cartões, Pix, vales, conta de funcionário), o tratamento correto das caixinhas da equipe (como crédito de funcionário) e das taxas de serviço, as retiradas imediatas para compras e despesas (sangrias), os aportes de troco (suprimentos), e a conferência final do turno confrontando o esperado pelo sistema com a contagem física do operador. Além disso, ele mantém a sincronização perfeita entre o PDV local (que opera offline no balcão) e a nuvem, garantindo que cada venda fique atrelada ao seu caixa legítimo sem misturar operadores.

## Regras de Negócio e Porquês

### Caixinha é estritamente o excedente do pagamento (`regra-caixinha-excedente`)
- **Regra:** Quando uma conta de R$ 182,00 é passada no débito ou dinheiro como R$ 200,00, a caixinha é apenas o excedente de R$ 18,00, e NUNCA o total da venda (R$ 200,00).
- **Por que é assim:** A caixinha não pertence ao restaurante e não sai da gaveta física no momento da venda. Ela permanece no caixa/banco da empresa e vira um crédito do funcionário/garçom no RH, podendo ser descontada em compras no restaurante ou paga no repasse periódico.
- **Decisão:** 29/09/2026 por Thomás Furtado
- **Onde no código:** `metrics/src/utils/cashier/caixinha.ts`, `metrics/src/utils/cashier/exportGeralPDF.ts`, `metrics/src/utils/cashier/exportGeralCSV.ts`, `metrics/src/utils/cashier/exportPDF.ts`, `metrics/src/pages/app/cashier/session/[id]/index.tsx`

### Serviço 10% NÃO é caixinha e compõe a nota fiscal (`regra-servico-nao-e-caixinha`)
- **Regra:** A taxa de serviço facultativa de 10% cobrada nas mesas é parte integrante da conta do restaurante e vai destacada no cupom/NFC-e. Ela nunca é somada no total das caixinhas.
- **Por que é assim:** Exigência fiscal e contábil: a taxa de serviço é faturamento da empresa com destinação legal regulamentada (Lei da Gorjeta), enquanto a caixinha voluntária é excedente espontâneo de repasse direto.
- **Decisão:** 29/09/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics/src/utils/cashier/caixinha.ts`

### O Dia Operacional do Caixa vira às 05:00 da manhã (`regra-dia-operacional-05h`)
- **Regra:** Caixas abertos durante a noite ou madrugada pertencem à competência do dia operacional anterior até as 05:00 da manhã.
- **Por que é assim:** Bares e restaurantes operam rotineiramente pela madrugada. Virar o dia à meia-noite (00:00) dividiria artificialmente o mesmo turno de trabalho em duas datas civis, corrompendo a conferência física e o faturamento do expediente.
- **Decisão:** 24/09/2026 por Thomás Furtado
- **Onde no código:** `metrics/src/utils/get-periodo-brt.ts`, `metrics-node/src/utils/get-competence-date.ts`

### Caixa Fechado opera em modo somente consulta (`regra-caixa-fechado-somente-consulta`)
- **Regra:** Um caixa encerrado não recebe novas vendas, não permite cancelamentos e não aceita troca de pagamentos. Permite apenas reimpressão de comprovantes e conferência.
- **Por que é assim:** Segurança contra fraudes após a contagem física das cédulas pelo operador. Qualquer ajuste posterior deve ser feito pelo gestor no SaaS Admin ou mediante reabertura autorizada.
- **Decisão:** 20/09/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Views/JanelaFechamentoCaixaWindow.xaml.cs`, `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts`

### A nuvem nunca altera o caixa de uma venda por conta própria (`regra-nuvem-nunca-escolhe-caixa`)
- **Regra:** Vendas do PDV ficam vinculadas ao caixa original onde foram abertas. Se o caixa for desconhecido ou já conferido (CHECKED), a sincronização rejeita com código 409 em português.
- **Por que é assim:** Evitar furos de caixa entre operadores: antes da regra, vendas com problemas caíam no caixa aberto mais recente de outro terminal, gerando quebras inexplicáveis para o operador inocente.
- **Decisão:** 25/09/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts`

### Saldo da Gaveta = Abertura + Entradas em Dinheiro - Sangrias (`regra-saldo-gaveta-fisica`)
- **Regra:** O valor esperado na gaveta física é composto por todo o dinheiro que entrou (inclusive excedente de caixinha pago em cédula), subtraído das retiradas físicas (sangrias).
- **Por que é assim:** O dinheiro da caixinha em cédula física entra de fato na gaveta e não sai dela no momento do pagamento. Subtrair a caixinha geraria uma falta de dinheiro fictícia na contagem do operador.
- **Decisão:** 29/09/2026 por Thomás Furtado
- **Onde no código:** `metrics/src/utils/cashier/exportGeralPDF.ts`, `metrics/src/utils/cashier/exportPDF.ts`

### Venda cancelada é removida de faturamento e conferência (`regra-venda-cancelada-excluida`)
- **Regra:** Vendas canceladas têm seus lançamentos de pagamento anulados no caixa e não pontuam no faturamento do expediente.
- **Por que é assim:** Valores estornados ou vendas desfeitas não podem ser exigidos na contagem do operador nem constar como receita real do estabelecimento.
- **Decisão:** 25/09/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts`, `metrics/src/pages/app/cashier/session/[id]/index.tsx`

### Consumo de funcionário vira débito na conta corrente do colaborador (`regra-consumo-funcionario-debito-rh`)
- **Regra:** Vendas lançadas como 'Conta Casa / Funcionário' exigem identificação de funcionário ativo e geram saldo devedor na ficha do colaborador no RH.
- **Por que é assim:** Permite que a empresa desconte refeições na folha de pagamento ou abata dos créditos de caixinha acumulados pelo colaborador.
- **Decisão:** 25/09/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics/src/pages/hr/employees/debt-management-dialog.tsx`

### Diferença de centavos no rateio de desconto vai para o maior item (`regra-rateio-desconto-maior-item`)
- **Regra:** Quando um desconto global é rateado entre os itens da venda, as sobras de arredondamento de centavos são atribuídas ao item de maior valor.
- **Por que é assim:** Exigência da SEFAZ: a soma dos descontos dos itens (vDesc) deve bater com precisão cirúrgica de centavos com o desconto totalizador da NFC-e para evitar rejeição.
- **Decisão:** 23/09/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/CalculoDescontoService.cs`

### Fechamento cego é opcional por loja (Padrão = Completo) (`regra-fechamento-cego-configuravel`)
- **Regra:** A opção de o operador contar valores sem visualizar os esperados é configurável por tenant. O padrão é o fechamento completo onde o operador confere os valores.
- **Por que é assim:** Flexibilidade operacional: estabelecimentos familiares preferem conferência transparente e rápida, enquanto operações de grande porte usam o fechamento cego para prevenir fraudes.
- **Decisão:** 27/09/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Views/JanelaFechamentoCaixaWindow.xaml.cs`

### O peso digitado no PDV tem 3 casas (os gramas) (`regra-peso-tres-casas`)
- **Regra:** Produto por peso (kg): os números entram pela direita com 3 casas, no campo da quantidade do Caixa e na janela do item: 6 vira 0,006 kg, 604 vira 0,604 kg, 1250 vira 1,250 kg. Até 9.999,999 kg. Em branco não lança. Na tela do Pagamento o item por peso aparece em kg.
- **Por que é assim:** O Thomás tinha escolhido 2 casas (como o dinheiro) em 06/10/2026 e corrigiu em 10/10/2026: o quilo trabalha com 3 casas, igual à etiqueta da balança (0,604 kg). O banco do PDV, o carrinho, a impressão, a NFC-e e a nuvem já guardavam 3 casas.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Helpers/QuantidadeDigitada.cs`, `Metrics.PDV/Metrics.PDV/Views/JanelaItemWindow.xaml.cs`, `Metrics.PDV/Metrics.PDV/Views/CaixaView.xaml.cs`

### Pagamento: a maquininha e o resto da forma pelo teclado (`regra-pagamento-maquininha-teclado`)
- **Regra:** Escolher Débito, Crédito, Pix ou Vale abre a escolha da maquininha (número, setas e Enter, ou toque; a última usada vem marcada). Com uma maquininha só, ela é escolhida sozinha. No Pix a lista traz também "Sem maquininha". Crédito vai em 1x sem perguntar; a tecla da forma de novo abre as parcelas. A prazo sem cliente abre a busca do cliente; consumo de funcionário abre a lista dos funcionários. O Enter nunca lança cartão sem maquininha.
- **Por que é assim:** Pedido do Thomás em 10/10/2026: os caixas que vieram do Athos fazem tudo pelo teclado; a lista suspensa embaixo só abria bem com o mouse e a 1ª maquininha ficava escolhida sem ninguém ver. No Athos da Katatau 99,99% do crédito é 1x.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Helpers/PassosDoPagamento.cs`, `Metrics.PDV/Metrics.PDV/Views/PagamentoView.xaml.cs`, `Metrics.PDV/Metrics.PDV/Views/EscolhaRapidaWindow.xaml.cs`

### A etiqueta da balança é lida sempre (`regra-etiqueta-balanca-sempre`)
- **Regra:** Código de 13 números que começa com 2, com o dígito verificador certo, que não é o código de barras de nenhum produto e que aponta para um produto cadastrado (o código do produto no formato da loja: 5 dígitos e preço total, de fábrica) entra direto: produto por peso com o peso (total ÷ preço do quilo) e produto por unidade com a quantidade (total ÷ preço). O total do item é o impresso na etiqueta. Não há opção de ligar.
- **Por que é assim:** Katatau, 10/10/2026: a opção de ligar vinha desligada e a etiqueta do BISCOITO AMANTEGADO KG virava "código não cadastrado". Na Katatau a balança imprime etiqueta também de produto por unidade (SONHO, PÃO DE MEL), por isso não há trava de "só por peso".
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/EtiquetaDeBalanca.cs`, `Metrics.PDV/Metrics.PDV/Views/CaixaView.xaml.cs`, `Metrics.PDV/Metrics.PDV/Views/LancamentoProdutosWindow.xaml.cs`

### Cada pagamento da venda do PDV diz se é fiado ou consumo de funcionário (`regra-tipo-do-pagamento`)
- **Regra:** O PDV manda em cada pagamento o tipo: PRAZO (fiado: forma de categoria Crédito da loja ou com prazo, correntista, permuta ou fiado no nome), FUNCIONARIO (consumo: funcionário, funcionario ou colaborador no nome) ou NENHUM. A nuvem usa o tipo do PDV; para o PDV antigo, os mesmos nomes. O cliente só vai no lançamento do caixa quando o pagamento é fiado.
- **Por que é assim:** Antes a nuvem adivinhava pelo nome (sem a permuta, que o PDV tratava como fiado) e punha o cliente da venda em TODOS os pagamentos: na conferência, o Pix ou o dinheiro de uma venda com cliente identificado virava "a prazo" desse cliente.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SincronizacaoVendaService.cs (TipoDoPagamento)`, `Metrics.PDV/Metrics.Shared/Helpers/FormaPagamentoTipo.cs`, `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts (paymentKind)`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`

### O fiado do PDV fica na conta do cliente, e a conta acompanha a venda (`regra-fiado-na-conta-do-cliente`)
- **Regra:** A venda a prazo abre a conta do cliente na nuvem (client_tabs, "Venda a Prazo - Pedido #xxxxxxxx"). Troca de pagamento muda o valor ou o cliente; cancelamento tira a parte não paga; parte já paga nunca é mexida. A conferência do caixa NÃO cria outra receita a prazo para esse fiado. Em Financeiro > Clientes a Prazo a conta aparece e a baixa a quita (inteira, parcial ou por permuta); o PDV mostra o saldo novo na sincronia seguinte. O painel do financeiro soma as contas abertas no "a receber" (vencimento: 30 dias depois da venda).
- **Por que é assim:** Decisão do Thomás de 25/09/2026: o registro oficial do fiado é a conta do cliente; o financeiro lê o a receber dessas contas. Até 10/10 a conta só era criada: a conferência criava outra receita, a baixa da web não chegava ao PDV e venda cancelada continuava devendo.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts (desiredClientTabs, planClientTabs)`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts (postCancellationsSync)`, `metrics-node/src/modules/cashier/http/controllers/cashier-controller.ts (auditCashierSession)`, `metrics-node/src/modules/financial/services/conta-do-cliente.ts`, `metrics-node/src/modules/financial/http/controllers/settlements.ts`, `metrics-node/src/modules/financial/http/controllers/settle-term-debt.ts`

### Consumo de funcionário vira vale num lugar só: a conferência do caixa (`regra-consumo-vira-vale-na-conferencia`)
- **Regra:** A venda do PDV paga com consumo de funcionário leva o funcionário do RH no lançamento do caixa (a nuvem aceita o id do funcionário ou o do usuário do sistema ligado a um). Ao conferir o caixa na web, o vale é lançado no RH; desfazer a conferência tira o vale. Venda cancelada antes da conferência some do caixa e não vira vale.
- **Por que é assim:** Antes o vale nascia quando a venda subia e de novo na conferência: o funcionário seria descontado em dobro, e a venda cancelada continuava como vale.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics-node/src/modules/cashier/http/controllers/cashier-controller.ts (auditCashierSession)`

### Sangria e vale do PDV chegam à conferência com o tipo certo (`regra-movimentos-do-pdv-na-conferencia`)
- **Regra:** Sangria do PDV = recolhimento (cofre ou dono), nunca despesa. Vale = saída para funcionário, com o funcionário do RH escolhido no PDV (nada vem marcado; sem escolher, não grava). Dois toques em Confirmar gravam uma vez só.
- **Por que é assim:** Decisões do Thomás de 25/09/2026 (sangria = recolhimento; vale com o funcionário do RH). Antes a sangria com observação virava despesa na conferência, e o vale ia só com o nome no texto: a conferência do caixa inteiro parava com "vale sem funcionário selecionado".
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Views/CaixaView.xaml.cs (ConfirmarMovimentoAsync)`, `Metrics.PDV/Metrics.Shared/Services/SincronizacaoCaixaService.cs`, `metrics-node/src/modules/pdv-sync/services/cashier-sync-rules.ts (movementEntryType)`, `metrics-node/src/modules/pdv-sync/http/controllers/cashier-sync-controller.ts`

### Formas, identificadores e maquininhas: cadastro só na web, o PDV espelha (`regra-cadastros-so-na-web`)
- **Regra:** Formas de pagamento (Configurações > Financeiro > Formas de Pagamento), identificadores (Caixa & Pagamentos > Identificadores) e maquininhas (Caixa & Pagamentos > Maquininhas & Taxas) são cadastrados só na web. O PDV mostra em Configurações só para consulta; a cada sincronia, o que não veio da web fica desativado no PDV. As formas e identificadores que o PDV cria sozinho só valem antes da primeira vinda da nuvem (configuração financeiro.nuvem). Cada maquininha leva o que aceita (pelas taxas da web: crédito, débito, Pix, vale) e o Pagamento só pergunta pelas maquininhas da forma (sem taxa = todo cartão).
- **Por que é assim:** Pedido do Thomás de 10/10/2026 ("a sincronia deve ser orgânica entre o PDV e o backend") e decisão no mesmo dia: só na web. Antes o PDV renomeava "A Prazo (Correntista)" para "A Prazo" a cada abertura, o desativado na web continuava no PDV, o criado no PDV nunca chegava à nuvem e os identificadores chegavam sem tipo.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/CadastrosDaNuvem.cs`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs (SyncFinancialConfigAsync)`, `Metrics.PDV/Metrics.PDV/App.xaml.cs`, `metrics-node/src/modules/pdv-sync/services/pagamentos-do-pdv.ts`, `metrics-node/src/modules/pdv-sync/http/controllers/pdv-sync-controller.ts`

### A forma A Prazo pergunta de quem (identificadores da web) (`regra-a-prazo-de-quem`)
- **Regra:** No Pagamento do PDV, escolher A Prazo abre "de quem?" com os identificadores a prazo da web (ex.: Correntista, Funcionário, Permuta; Enter escolhe o 1º). Funcionário pede o funcionário do RH e vira consumo (a venda inteira, vale na conferência); os outros pedem o cliente (conta do cliente). A tecla da forma de novo troca. Sem identificadores cadastrados, pede o cliente direto. Cortesia e pró-labore (evasão) não aparecem (decisão de 28/09).
- **Por que é assim:** Decisão do Thomás de 10/10/2026: uma forma "A Prazo" que pergunta de quem. Na Katatau o consumo é o identificador Funcionário, e o PDV só fazia consumo com uma forma de nome "funcionário", que lá não existe.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Views/PagamentoView.xaml.cs (EscolherDeQuem)`, `Metrics.PDV/Metrics.Shared/Helpers/FormaPagamentoTipo.cs (EhConsumo)`

### A venda do PDV chega à conferência com os nomes do caixa da web (`regra-venda-com-nomes-da-web`)
- **Regra:** Cada pagamento sobe com a categoria, o identificador e a maquininha pelos códigos da web. A nuvem grava o lançamento com o nome do caixa da web (Dinheiro, PIX, Débito, Crédito, Voucher, ou o identificador: Correntista, Funcionário, Permuta) e o nome atual da maquininha. A conferência acha a taxa e o prazo pela categoria (CRÉDITO = CREDIT = Cartão de Crédito; VOUCHER = Vale Refeição).
- **Por que é assim:** Antes ia o nome do PDV ("Vale Refeição (VR/Sodexo/Alelo)") e a conferência não achava a taxa de vale nem o prazo D+30; a taxa cadastrada em inglês (CREDIT) nunca casava.
- **Decisão:** 10/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics-node/src/modules/cashier/http/controllers/cashier-controller.ts (auditCashierSession)`, `Metrics.PDV/Metrics.Shared/Services/SincronizacaoVendaService.cs`

### Cada venda sobe com o item como foi vendido e com a NFC-e (`regra-venda-produto-a-produto`)
- **Regra:** O PDV manda em cada venda, por item: o nome como foi vendido (pizza de sabores, item de delivery sem vínculo), o vendedor (quem lançou: o funcionário do RH quando é um, o nome e o número do vendedor), as escolhas (complementos e observações rápidas, com grupo, quantidade e preço) e só o texto livre da observação; e na venda a NFC-e (situação, número, série, ambiente, chave, se saiu em contingência e o motivo da recusa). Situações: SEM_NOTA, RECUSADA, CONTINGENCIA, AUTORIZADA, CONTINGENCIA_RECUSADA, CANCELAMENTO_PENDENTE, CANCELADA, CANCELAMENTO_FALHOU. Tudo opcional: o PDV antigo não manda e nada muda; venda antiga fica com "—". Item que já estava na nuvem só é completado no que falta, nunca trocado.
- **Por que é assim:** O módulo Vendas da web mostra venda por venda e produto por produto (D3); sem o nome congelado, o histórico mudaria junto com o cadastro, e sem o vendedor e a nota não há aba Vendedores nem a nota no detalhe da venda (D4). Não mexe em dinheiro, caixa nem estoque, então completa a venda até em caixa conferido.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/services/dados-da-venda.ts`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `Metrics.PDV/Metrics.Shared/Services/SincronizacaoVendaService.cs (MontarPayloadVenda, EscolhasDoItem, ObservacaoLivreDoItem)`, `Metrics.PDV/Metrics.Shared/Services/NotaFiscalDaVenda.cs (Situacao, Montar)`

### A nota que muda depois da venda sobe sozinha, e a mais velha nunca passa por cima da nova (`regra-nota-que-muda-depois`)
- **Regra:** Ao gravar, o PDV carimba a hora em que a nota de uma venda mudou (pedidos.nfce_alterada_em; um lugar só, no AppDbContext, para todas as telas e o serviço): emitida pelo F9 "Emitir a nota", contingência autorizada, cancelada na SEFAZ (também a que cancela quando a internet volta), recusada. A venda que já subiu e tem carimbo mais novo que o da nuvem (pedidos.nfce_na_nuvem_em) manda só a nota pela rota POST /api/pdv/sync/sales/fiscal, na sincronia de 5 em 5 minutos, sem reenviar a venda. A nuvem guarda a hora (sales.nfce_changed_at) e só aceita a mudança igual ou mais nova. A nota só é dada por entregue quando a nuvem responde notaFiscal: true; com a nuvem antiga (404) o PDV espera 1 hora e tenta de novo, sem contar como falha.
- **Por que é assim:** A nota muda depois da venda em vários lugares (tela Vendas, cancelamento, serviço da contingência) e o envio da venda e o da nota podem chegar fora de ordem. Reenviar a venda inteira esbarraria nas regras do caixa (caixa conferido recusa mudança); a nota não é dinheiro e precisa chegar sempre.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/NotaFiscalDaVenda.cs (MarcarMudancas, ParaEnviar)`, `Metrics.PDV/Metrics.Shared/Data/AppDbContext.cs (SaveChangesAsync)`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs (SyncNotasDasVendasAsync)`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-fiscal-sync-controller.ts`, `metrics-node/src/modules/pdv-sync/services/dados-da-venda.ts (gravarNotaFiscal, ondeGravarANota)`

### Uma conta só para o vendido e o recebido (Dashboard, Conferência de caixa e Vendas) (`regra-conta-unica-vendido-recebido`)
- **Regra:** A nuvem calcula, para um caixa e/ou um período (dias operacionais) da loja: "Total vendido" = as vendas não canceladas (o total que o PDV fechou: itens − desconto + entrega + serviço + couvert) mais o que foi lançado no caixa da web sem venda registrada (loja sem PDV, sem a parte da caixinha); "Total recebido" = os pagamentos das formas que se contam (dinheiro, Pix, cartões, vale), por forma, com o banco/maquininha e o "Sem maquininha". A linha que explica a diferença: Vendido − a prazo (fiado, consumo de funcionário, permuta, cortesia) − aplicativos a receber (pago no app do iFood/99) + caixinha = Recebido; o que sobrar aparece como "venda sem pagamento registrado" ou "pagamento sem venda". As canceladas ficam fora dos dois totais e são contadas à parte. Sangria e suprimento são da gaveta e não entram.
- **Por que é assim:** Antes cada tela somava do seu jeito (o cartão "Faturamento Total" da Conferência somava até suprimento e chamava o a prazo de "digital"), e os números não batiam entre si nem com o fechamento do PDV. A separação é a mesma do PDV (formas contadas × "Sem contagem física", ConferenciaDoFechamento): o dinheiro do a prazo e do aplicativo ainda não entrou, então não pode ser cobrado do caixa.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/sales/services/conta-das-vendas.ts`, `metrics-node/src/modules/sales/services/consultas-das-vendas.ts (carregarConta)`, `metrics/src/pages/app/cashier/components/LinhaDaConta.tsx`, `metrics/src/pages/app/cashier/dashboard/index.tsx`, `metrics/src/pages/app/cashier/session/[id]/index.tsx`, `Metrics.PDV/Metrics.Shared/Services/ConferenciaDoFechamento.cs`

### O módulo "Vendas" substitui a "Conferência caixa" no menu, com cinco abas (`regra-modulo-vendas-cinco-abas`)
- **Regra:** No menu da web o módulo chama "Vendas" (mesmo endereço /cashier e mesma permissão). Abas, nesta ordem: 1. Vendas (venda a venda, com filtros e o detalhe), 2. Conferência de caixa (a tela de sempre, com Salão ao vivo e Motoboys dentro dela), 3. Produtos vendidos, 4. Cancelamentos, 5. Vendedores. A aba e a venda aberta ficam no endereço (?aba=…&venda=…). O operador de caixa (CASHIER) abre na Conferência; os outros abrem em Vendas.
- **Por que é assim:** Decisões D1 e D2: a venda e o caixa são a mesma amarração; a conferência fica em segundo. A antiga aba "Cancelamentos & Desperdício" mostrava exemplos fixos quando a consulta falhava (chamava uma rota que exige a chave do PDV): virou a aba Cancelamentos com os dados de verdade.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics/src/components/sidebar.tsx`, `metrics/src/pages/app/cashier/vendas/vendas-page.tsx`, `metrics/src/routes.tsx`

### Venda cancelada continua na lista, riscada, fora dos totais (`regra-venda-cancelada-na-lista`)
- **Regra:** Na aba Vendas a venda cancelada aparece riscada, com o selo "Cancelada", o motivo, quem e quando (do registro do cancelamento); fica fora do total da lista e da conta única. No detalhe, o item cancelado aparece riscado. A aba Cancelamentos junta vendas inteiras e itens, com filtro por motivo, pessoa e tipo, e diz se voltou ao estoque (stock_restored: a escolha "Devolver ao estoque" que foi aplicada).
- **Por que é assim:** Decisão D12: esconder a cancelada apagaria a prova do que aconteceu no caixa; somar a cancelada inflaria o vendido.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/sales/services/relatorios-das-vendas.ts (linhaDaVenda, detalheDaVenda, relatorioDeCancelamentos)`, `metrics/src/pages/app/cashier/vendas/aba-cancelamentos.tsx`

### De onde a venda veio: uma regra só (Balcão, Mesa, Comanda, Delivery, iFood, 99Food) (`regra-origem-da-venda`)
- **Regra:** A origem vem do que o PDV manda: a origem do pedido (Balcao, Salao, Mesa, "Mesa 21 Conta B", Delivery, iFood, 99Food), a mesa/comanda (origin_identifier) e a plataforma dos pagamentos (platform_code, para o pedido do iFood/99 pago em dinheiro). "Balcao" com número é comanda (o PDV cobra a comanda como balcão); sem número é o balcão. A lista, o detalhe e o filtro usam a mesma regra.
- **Por que é assim:** O PDV não manda o tipo do atendimento; sem uma regra única o filtro e a etiqueta da lista podiam discordar.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/sales/services/filtros-das-vendas.ts (origemDaVenda, ondeAOrigem)`

### O período do módulo Vendas é em dias operacionais e pela data da venda (`regra-periodo-das-vendas`)
- **Regra:** "Hoje", "Ontem", "7 dias", "Este mês", "Mês passado" e as datas escolhidas são dias operacionais (viram às 05:00 de Brasília): a venda das 02:00 do dia 17 é do dia 16. A venda entra no período pela hora em que foi fechada no PDV; o lançamento da web sem venda, pela própria hora. Só o caixa (sem datas) = o caixa inteiro. No máximo um ano por consulta.
- **Por que é assim:** Mesma virada do caixa e do PDV. Num dia normal (um caixa por dia) a aba Vendas do dia e a Conferência daquele caixa mostram o mesmo total; caixa que fica aberto de um dia para o outro aparece inteiro na Conferência e dividido por dia em Vendas.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/sales/services/filtros-das-vendas.ts (intervaloDosDias)`, `metrics/src/utils/vendas/formatos.ts`

### Custo e margem só para quem já vê o custo hoje (`regra-custo-e-margem-quem-ve`)
- **Regra:** Custo (o congelado na hora da venda) e margem aparecem no detalhe, em Produtos vendidos e no CSV/PDF só para quem pode usar Mercadorias, Controle de Estoque ou Financeiro (ADMIN vê). O operador de caixa (CASHIER) não vê: a nuvem nem manda. O operador de caixa só vê as vendas dos caixas dele, como na lista de caixas da Conferência. Item sem custo congelado (venda antiga) entra no faturamento e fica fora da margem.
- **Por que é assim:** Decisão D9: as permissões por grupo ficam para depois; até lá vale a regra de acesso de hoje, em que o custo só aparece em Mercadorias e no Estoque.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/sales/services/consultas-das-vendas.ts (acessoDoUsuario)`, `metrics-node/src/modules/sales/services/relatorios-das-vendas.ts`

### A venda guarda na nuvem o número do pedido, a senha do dia e o cliente (`regra-numero-senha-cliente-da-venda`)
- **Regra:** O PDV sempre mandou DisplayId, NumeroDiario e ClienteUuid; desde o módulo Vendas a nuvem guarda em sales.display_id, sales.daily_number e sales.client_id (o cliente só se já está na nuvem; senão fica vazio e a venda passa). Reenvio só completa o vazio, até em caixa conferido (não mexe em dinheiro). Venda antiga fica com "—" até o PDV reenviar.
- **Por que é assim:** A lista "venda a venda" precisa do número e da senha que o caixa conhece (D2, D3), e o detalhe mostra o cliente.
- **Decisão:** 16/10/2026 por Thomás Furtado
- **Onde no código:** `metrics-node/src/modules/pdv-sync/services/dados-da-venda.ts (numeracaoDaVenda, numeracaoQueFalta)`, `metrics-node/src/modules/pdv-sync/http/controllers/sales-sync-controller.ts`, `metrics-node/prisma/migrations/20261016220000_modulo_vendas/migration.sql`

### Item tirado da comanda no Caixa: motivo, cancelado na comanda e ela fecha normalmente (`regra-item-tirado-da-comanda-no-caixa`)
- **Regra:** No Caixa do PDV (comanda puxada pelo Home), tirar um item da comanda com outros itens na venda pede o motivo: Cliente não consumiu, Cliente desistiu do pedido, Erro de lançamento do operador, Demora no preparo da cozinha, Item incorreto / trocado, ou Deixar na comanda. Com um motivo, ao cobrar a venda o item é cancelado na comanda (itens_cancelados, ligado à venda, estoque devolvido, sem papel na cozinha, sem PIN; sobe para a nuvem e aparece em Vendas › Cancelamentos) e a comanda que fica vazia é liberada. "Deixar na comanda" tira só desta venda e o item continua nela para pagar depois. Nada muda antes de cobrar: Limpar, Desfazer e puxar de novo desfazem o motivo.
- **Por que é assim:** Na Katatau o cliente contesta um item no caixa ("a Coca não teve"); antes o caixa tirava o item, cobrava, e a comanda ficava aberta no Salão com a Coca. A comanda não precisa fechar com todos os itens para estar correta.
- **Decisão:** 17/10/2026 por Thomás Furtado
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Comandas.cs (ItemTirado, MotivosAoTirar, FecharNaVendaAsync)`, `Metrics.PDV/Metrics.Shared/Services/AcoesDaMesa.cs (RegistrarCancelamento)`, `Metrics.PDV/Metrics.PDV/Views/CaixaView.xaml.cs (RemoverLinhaComDesfazer, PerguntarMotivoDeTirar)`, `Metrics.PDV/Metrics.PDV/Views/PagamentoView.xaml.cs (ItensTiradosDasComandas)`

## Funções de Negócio

### `AbrirTurnoCaixa`
- **O que faz:** Inicia o expediente do caixa registrando o operador responsável, data/hora e o fundo de troco inicial em dinheiro.
- **Motivo de negócio:** Isolar as movimentações físicas de dinheiro por turno e operador, garantindo auditoria de saldo inicial.
- **Entradas:** operador_id, terminal_id, fundo_inicial_dinheiro, periodo
- **Saídas:** sessao_caixa_id, status: OPEN
- **Usada por:** ['Operador de Caixa']
- **Tabelas afetadas:** `nuvem:CashierSession`, `pdv:CaixaAberturaFechamento`

### `RegistrarPagamentoVenda`
- **O que faz:** Recebe os pagamentos divididos por meio (Dinheiro, Débito, Crédito, Pix, Voucher, Conta Casa) e conclui a venda.
- **Motivo de negócio:** Baixar o débito do cliente, alimentar os saldos da gaveta e dos bancos correspondentes.
- **Entradas:** venda_id, pagamentos: [{ forma, valor, bandeira, cliente_id, colaborador_id }]
- **Saídas:** lancamentos_caixa_ids, venda_status: COMPLETED, troco
- **Usada por:** ['Caixa do Balcão', 'Garçom']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:CashierEntry`, `pdv:Pedido`, `pdv:PagamentoPedido`

### `CalcularExcedenteCaixinha`
- **O que faz:** Extrai o valor pago a mais pelo cliente além do total da conta e destina como crédito de caixinha da equipe/funcionário.
- **Motivo de negócio:** Separar a gorjeta voluntária do faturamento do restaurante, sem tributação indevida e sem saída física imediata da gaveta.
- **Entradas:** total_conta, total_pago, funcionario_destinatario
- **Saídas:** valor_caixinha_excedente, identificacao_marcada
- **Usada por:** ['Conferência de Caixa', 'Fechamento de Turno']
- **Tabelas afetadas:** `nuvem:CashierEntry`

### `RealizarSangria`
- **O que faz:** Registra uma saída de dinheiro físico da gaveta categorizada (despesa operacional, recolhimento para cofre ou vale de funcionário).
- **Motivo de negócio:** Evitar excesso de dinheiro no caixa e justificar saídas físicas imediatas sem provocar furos na contagem final.
- **Entradas:** sessao_caixa_id, valor, tipo_sangria, motivo, favorecido
- **Saídas:** registro_sangria_id, saldo_gaveta_atualizado
- **Usada por:** ['Operador de Caixa', 'Gerente de Turno']
- **Tabelas afetadas:** `nuvem:CashierEntry`, `pdv:MovimentoCaixa`

### `RealizarSuprimento`
- **O que faz:** Registra um aporte de dinheiro físico na gaveta para recomposição de troco durante o turno.
- **Motivo de negócio:** Injetar dinheiro miúdo e moedas na gaveta sem misturar aporte financeiro com faturamento de vendas.
- **Entradas:** sessao_caixa_id, valor, motivo
- **Saídas:** registro_suprimento_id, saldo_gaveta_atualizado
- **Usada por:** ['Operador de Caixa', 'Gerente']
- **Tabelas afetadas:** `nuvem:CashierEntry`, `pdv:MovimentoCaixa`

### `DividirContaMesa`
- **O que faz:** Permite que uma mesa pague frações da conta por pessoa ou selecionando itens específicos consumidos.
- **Motivo de negócio:** Atender ao hábito essencial de clientes em bares e restaurantes que dividem despesas em grupos.
- **Entradas:** comanda_id, itens_ou_valor_por_pessoa, formas_pagamento
- **Saídas:** pagamentos_registrados, saldo_restante_mesa
- **Usada por:** ['Operador de Caixa', 'Garçom']
- **Tabelas afetadas:** `pdv:Pedido`, `pdv:PagamentoPedido`, `nuvem:Sale`

### `FecharTurnoCaixa`
- **O que faz:** Encerra o turno de caixa. O operador declara os valores contados e o sistema calcula sobra ou quebra de caixa.
- **Motivo de negócio:** Confrontar a contagem real com o fluxo sistêmico e auditar a responsabilidade financeira do operador.
- **Entradas:** sessao_caixa_id, valores_contados_por_forma
- **Saídas:** relatorio_fechamento, diferenca_sobra_quebra, status: PENDING_AUDIT
- **Usada por:** ['Operador de Caixa', 'Conferente']
- **Tabelas afetadas:** `nuvem:CashierSession`, `pdv:CaixaAberturaFechamento`

### `CancelarVendaTurno`
- **O que faz:** Cancela uma venda no caixa aberto, anula pagamentos, retorna itens ao estoque e cancela a NFC-e na SEFAZ.
- **Motivo de negócio:** Permitir correção de erros de lançamento ou desistência do cliente mantendo rastro fiscal e auditoria.
- **Entradas:** venda_id, motivo_cancelamento, senha_gerente
- **Saídas:** venda_status: CANCELLED, status_nfce: CANCELADA, estorno_financeiro
- **Usada por:** ['Gerente de Loja', 'Caixa autorizado']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:CashierEntry`, `pdv:Pedido`

### `AlterarFormaPagamento`
- **O que faz:** Altera a forma de pagamento de uma venda já concluída sem cancelar a nota nem mexer nos itens vendidos.
- **Motivo de negócio:** Corrigir enganos de digitação na maquininha sem a burocracia de cancelamento fiscal de mercadorias.
- **Entradas:** venda_id, novos_pagamentos
- **Saídas:** lancamentos_atualizados, reenvio_sync_pendente
- **Usada por:** ['Operador de Caixa', 'Gerente']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:CashierEntry`, `pdv:PagamentoPedido`

### `ConferirCaixaNoAdmin`
- **O que faz:** O gestor audita o turno do caixa, valida os comprovantes e marca o caixa como auditado (CHECKED), travando edições.
- **Motivo de negócio:** Encerrar o ciclo contábil do restaurante, garantindo que caixas já conferidos não sofram alterações posteriores por sincronia.
- **Entradas:** sessao_caixa_id, observacoes_auditoria
- **Saídas:** sessao_status: CHECKED, liberado_financeiro: true
- **Usada por:** ['Gestor Financeiro', 'Dono do Restaurante']
- **Tabelas afetadas:** `nuvem:CashierSession`, `nuvem:CashierEntry`

### `AtualizarNotaDaVenda`
- **O que faz:** Recebe do PDV a NFC-e de vendas que já subiram e mudaram depois, e grava só as colunas da nota (nunca dinheiro, caixa, itens ou estoque).
- **Motivo de negócio:** A tela Vendas da web mostra a situação real da nota (autorizada, cancelada, contingência, sem nota) mesmo quando ela muda depois da venda; idempotente para o PDV poder repetir sem medo.
- **Entradas:** lista de { Uuid da venda, NotaFiscal: Situacao, Numero, Serie, Ambiente, Chave, Contingencia, Motivo, AlteradaEm }
- **Saídas:** accepted (gravadas ou a nuvem já tinha uma mais nova), naoEncontradas (a nuvem não tem a venda), notaFiscal: true
- **Usada por:** ['PDV (sincronia de 5 em 5 minutos)']
- **Tabelas afetadas:** `nuvem:Sale`, `pdv:Pedido`

### `ContaDasVendas`
- **O que faz:** Calcula o Total vendido, o Total recebido (por forma e maquininha) e a linha que explica a diferença de um caixa e/ou período.
- **Motivo de negócio:** Uma conta só para o Dashboard, a Conferência de caixa e o módulo Vendas (D11), com a mesma separação do fechamento do PDV.
- **Entradas:** de, ate (dias operacionais), caixa
- **Saídas:** vendido (total, itens, taxas, descontos, lançado sem venda, ticket médio), recebido (dinheiro, eletrônico, por forma com maquininhas), semContagem (a prazo e aplicativos), caixinha, cancelados, diferenca (a linha em palavras)
- **Usada por:** ['Web: Conferência de caixa (cartões do mês), página do caixa, aba Vendas, Produtos vendidos']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:CashierEntry`, `nuvem:Payment`, `nuvem:PaymentIdentifier`

### `ListarVendas`
- **O que faz:** Lista as vendas venda a venda, paginada, com filtros (período, caixa, origem, forma, vendedor, produto, situação e busca por número, senha, mesa, produto, cliente ou código).
- **Motivo de negócio:** Ver na web venda por venda o que o PDV vendeu (D2, aba 1); o CSV e o PDF usam a mesma lista (D10).
- **Entradas:** filtros, pagina, porPagina (até 500)
- **Saídas:** vendas (dia e hora, número/senha, origem, caixa e computador, formas, nota, total, cancelada com motivo), total, totais (vendas, canceladas, valor sem as canceladas)
- **Usada por:** ['Web: Vendas › Vendas']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:CashierEntry`, `nuvem:CashierSession`, `nuvem:CancellationAudit`

### `DetalharVenda`
- **O que faz:** Mostra tudo de uma venda: cabeçalho, itens (nome como vendido, complementos, observação, vendedor, custo e margem), pagamentos (tipo e pessoa do a prazo, maquininha, caixinha), nota fiscal, baixas do estoque e cancelamentos.
- **Motivo de negócio:** Decisão D3: o detalhe mostra tudo, para conferir uma venda sem ir ao PDV.
- **Entradas:** id da venda
- **Saídas:** o detalhe completo (venda antiga: "—" no que não tem)
- **Usada por:** ['Web: Vendas (tocar numa venda), Cancelamentos (Abrir a venda)']
- **Tabelas afetadas:** `nuvem:Sale`, `nuvem:SaleItem`, `nuvem:CashierEntry`, `nuvem:Stock`, `nuvem:CancellationAudit`, `nuvem:CashierSession`

### `SomarProdutosVendidos`
- **O que faz:** Soma produto a produto no período: quantidade, em quantas vendas, faturamento, custo congelado, margem e participação; filtros de origem, caixa, vendedor e produto.
- **Motivo de negócio:** Aba Produtos vendidos (D2) e o CSV/PDF dela (D10).
- **Entradas:** de, ate, origem, caixa, vendedor, produto
- **Saídas:** produtos, totais, conta (rodapé: itens − descontos + taxas = Total vendido)
- **Usada por:** ['Web: Vendas › Produtos vendidos']
- **Tabelas afetadas:** `nuvem:SaleItem`, `nuvem:Sale`, `nuvem:Product`

### `SomarPorVendedor`
- **O que faz:** Soma quanto cada vendedor vendeu no período, item por item, com os produtos de cada um; itens sem vendedor ficam em "Sem vendedor".
- **Motivo de negócio:** Aba Vendedores (D2); o vendedor é de cada item (D4).
- **Entradas:** de, ate, caixa, origem
- **Saídas:** vendedores (itens, vendas, faturamento, participação, produtos)
- **Usada por:** ['Web: Vendas › Vendedores']
- **Tabelas afetadas:** `nuvem:SaleItem`, `nuvem:Employee`

### `ListarCancelamentos`
- **O que faz:** Lista as vendas e os itens cancelados no período, com motivo, quem, quando, se voltou ao estoque e a venda ligada; filtros por motivo, pessoa e tipo.
- **Motivo de negócio:** Aba Cancelamentos (D12), no lugar da antiga com exemplos fixos.
- **Entradas:** de, ate, motivo, pessoa, tipo (vendas, itens)
- **Saídas:** cancelamentos, totais, motivos e pessoas do período (para os filtros)
- **Usada por:** ['Web: Vendas › Cancelamentos']
- **Tabelas afetadas:** `nuvem:CancellationAudit`, `nuvem:Sale`

## Trabalhos que rodam o tempo todo

### Caixa do servidor visto pelo terminal — Ok
- **Frequência:** a cada 10 s
- **Onde roda:** PDV de terminal sem caixa próprio, tela Caixa aberta → `Banco do servidor da loja`
- **Por que existe:** O terminal acompanha o caixa aberto no servidor.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Views/CaixaView.xaml.cs:2645`

### Entrega do "caixa sem servidor" — Ok
- **Frequência:** a cada 15 s, só se houver fila
- **Onde roda:** Core Service de todo computador da loja → `Core Service do servidor (não chama a nuvem)`
- **Por que existe:** Venda feita num computador enquanto o servidor estava fora volta para o servidor quando ele aparece.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/EntregaDoCaixaSemServidor.cs:21`

### Envio de vendas, caixas e cancelamentos para a nuvem — Ok
- **Frequência:** venda: na hora; o resto a cada 5 min (sincronia geral do PDV), só se houver pendência
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: /api/pdv/sync/sales, /sync/cashier/open|movements|close, /sync/cancellations, /sync/sales/fiscal (nota que mudou depois da venda)`
- **Quantos:** 1 por loja
- **A cada vez:** Zero chamadas quando não há pendência; espera mais a cada falha (SyncBackoff). A nota que muda depois sobe pela rota da nota, até 100 por rodada; nuvem antiga (404) = espera 1 hora.
- **Por que existe:** A nuvem (web, relatórios, financeiro) tem de ter tudo o que o PDV vendeu, mesmo depois de a internet cair.
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/SincronizacaoVendaService.cs:157`, `Metrics.PDV/Metrics.Shared/Services/SincronizacaoCaixaService.cs:200`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs:530`, `Metrics.PDV/Metrics.Shared/Services/SyncManagerBackground.cs (SyncNotasDasVendasAsync)`

## Tabelas e Estrutura de Dados

### Caixa (`cashier_sessions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada caixa aberto, no PDV ou na web. No PDV tem o mesmo código do caixa local. Situação: aberto (OPEN), fechado esperando conferência (PENDING), conferido (CHECKED). Desde o backend 2.6.89 guarda o terminal, quem criou (PDV ou web), o contado em cada forma no fechamento e a quebra ou sobra.
- **Quem grava:** A web ao abrir o caixa; o PDV ao abrir e ao fechar. O reenvio não reabre nem renumera, e caixa conferido não muda. Caixa aberto na web e vinculado pelo PDV passa a ter o terminal do PDV.
- **Quem lê:** Conferência de caixa e auditoria mensal.
- **Cresce:** 1 a 3 linhas por dia.
- **Espelho no PDV/nuvem:** Caixa (PDV) (`caixas`)

### Lançamento do caixa (`cashier_entries`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Cada entrada ou saída do caixa: um por pagamento de venda e um por sangria, suprimento, despesa ou vale. É o que a Conferência soma por forma de pagamento. O lançamento de venda aponta a venda (sale_id) e leva a maquininha usada.
- **Quem grava:** A web (lançamento manual e baixa de delivery) e o PDV (vendas e movimentos).
- **Quem lê:** Conferência de caixa.
- **Cresce:** ~230 por dia num restaurante de 200 vendas (1,1 por venda, mais os movimentos).
- **Espelho no PDV/nuvem:** Movimento do caixa (PDV) (`caixa_transacoes`)

### Venda (`sales`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Uma venda fechada no PDV: balcão, mesa ou salão. Tem o mesmo código do pedido no PDV. Guarda total, desconto, situação, origem, a mesa ou comanda de onde veio, frete, taxa de serviço e couvert. Desde o módulo Vendas (16/10/2026) guarda também o número do pedido no PDV, a senha do dia e o cliente da venda.
- **Quem grava:** O PDV, na hora do pagamento e no ciclo de 5 minutos. A nuvem recusa com motivo venda sem caixa, de caixa desconhecido ou de caixa conferido.
- **Quem lê:** O módulo Vendas da web (lista venda a venda, detalhe, produtos vendidos, vendedores, cancelamentos), a conta única (Total vendido × Total recebido) do Dashboard e da Conferência de caixa, e o custo da mercadoria vendida (CMV).
- **Cresce:** 200 por dia (~73 mil por ano) no exemplo.
- **Espelho no PDV/nuvem:** Pedido (PDV) (`pedidos`)

### Item vendido (`sale_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Produto, quantidade, preço e o custo congelado na hora da venda, com o retrato de como o custo foi calculado.
- **Quem grava:** O PDV, junto com a venda. A baixa de estoque é feita pela nuvem ao gravar o item.
- **Quem lê:** Custo (CMV) e, no futuro, o relatório de produtos vendidos.
- **Cresce:** 600 por dia (~220 mil por ano) no exemplo. O retrato do custo (cost_snapshot) é o campo mais pesado.
- **Espelho no PDV/nuvem:** Item do pedido (PDV) (`pedido_itens`)

### Fiado (`client_tabs`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Conta a receber do cliente, criada quando a venda do PDV tem pagamento a prazo. Liga à venda só pelo texto.
- **Quem grava:** Só a sincronia do PDV. O fiado lançado na web vira receita a prazo, não esta conta.
- **Cresce:** Poucos por dia.

### Cancelamento (`cancellation_audits`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Registro de cada item ou venda cancelada, com motivo, operador e origem. Aponta a venda pelo código, sem chave.
- **Quem grava:** O PDV, no ciclo de 5 minutos (voltou a subir no PDV 2.4.19.0).
- **Cresce:** Poucos por dia.
- **Espelho no PDV/nuvem:** Item cancelado (PDV) (`itens_cancelados`)

### Caixa (PDV) (`caixas`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** O caixa aberto neste terminal. Um aberto por terminal.
- **Quem grava:** CaixaView (abertura) e FechamentoCaixaView (fechamento).
- **Espelho no PDV/nuvem:** Caixa (`cashier_sessions`)

### Movimento do caixa (PDV) (`caixa_transacoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Sangria, suprimento, saída operacional, vale, sobra e quebra lançados no caixa do PDV.
- **Espelho no PDV/nuvem:** Lançamento do caixa (`cashier_entries`)

### Pedido (PDV) (`pedidos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** A venda do PDV, de qualquer origem (balcão, mesa, delivery, iFood, 99Food), com NFC-e, controle de sincronia e totais.
- **Quem grava:** Caixa, Mesas, Delivery e o observador de pedidos online.
- **Cresce:** Um por venda ou pedido.
- **Espelho no PDV/nuvem:** Venda (`sales`)

### Item do pedido (PDV) (`pedido_itens`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Item lançado no pedido, com o custo congelado no momento do lançamento.
- **Espelho no PDV/nuvem:** Item vendido (`sale_items`)

### Pagamento (PDV) (`pedido_pagamentos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cada pagamento do pedido: forma, maquininha, parcelas, cliente do fiado e colaborador.
- **Espelho no PDV/nuvem:** Lançamento do caixa (`cashier_entries`)

### Item cancelado (PDV) (`itens_cancelados`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Registro de cancelamento de item ou venda, com destino do estoque escolhido pelo operador (estorno ou desperdício).
- **Espelho no PDV/nuvem:** Cancelamento (`cancellation_audits`)

### Alteração de Pagamento (`pagamento_alteracoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Auditoria de troca de forma de pagamento realizada após a finalização de uma venda no PDV. Registra a forma anterior, a nova forma, o motivo e o operador responsável, prevenindo fraudes na conferência do caixa.
- **Quem grava:** Metrics.PDV ao editar pagamento de venda já finalizada
- **Quem lê:** Metrics.PDV na consulta de vendas e relatórios de auditoria
- **Cresce:** Por evento de alteração de pagamento

### Venda Guardada (`vendas_guardadas`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Venda pausada/estacionada no balcão do PDV (ex.: cliente foi ao carro buscar a carteira ou esqueceu algo). Permite liberar o caixa para o próximo cliente da fila e recuperar os itens depois.
- **Quem grava:** Metrics.PDV ao acionar o botão 'Guardar Venda' no balcão
- **Quem lê:** Metrics.PDV ao listar e recuperar vendas guardadas para finalização
- **Cresce:** Temporária: registros são removidos ou limpos ao recuperar a venda

### Contador da senha do dia (`contador_senhas_diarias`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** A última senha usada em cada dia operacional (o dia vira às 05:00): é o número do pedido de balcão e de delivery (NumeroDiario do pedido). O próximo número é sempre maior que o maior pedido do dia, para a senha do balcão não repetir o número de um pedido online (cardápio, iFood, 99Food) nem duplicar com dois caixas ao mesmo tempo.
- **Quem grava:** PDV, ao abrir um pedido de balcão ou delivery (SenhaDiariaService); na troca de servidor, o resgate das vendas leva o maior número para o servidor novo.
- **Quem lê:** PDV, ao dar a senha do pedido.
- **Cresce:** Uma linha por dia operacional (cerca de 365 por ano).

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Caixa (PDV) | Caixa | Mesmo código (uuid do PDV = id na nuvem). |
| Movimento do caixa (PDV) | Lançamento do caixa | Mesmo código. |
| Pedido (PDV) | Venda | Mesmo código, quando fecha. Delivery hoje não vira venda (paliativo). |
| Item do pedido (PDV) | Item vendido | Mesmo código. |
| Pagamento (PDV) | Lançamento do caixa | Um lançamento por pagamento; hoje ligado pelo texto, proposta sale_id. |
| Item cancelado (PDV) | Cancelamento | Mesmo código. |

## Uma venda de mesa, do começo ao fim

| Momento | No PDV (banco local) | Na nuvem |
|---|---|---|
| Abrir a mesa e lançar itens | atendimentos, pedidos (Aberto) e pedido_itens | Mesa aberta e item na mesa, como foto, a cada 5 minutos |
| Transferir um item | O item muda de pedido e ganha uma linha em log_transferencias | Só a foto muda. A transferência não sobe. |
| Fechar a conta e pagar | O pedido vira Fechado e ganha pedido_pagamentos | Venda, itens vendidos, um lançamento por pagamento e as baixas de estoque. Fiado vira conta do cliente; consumo de funcionário vira vale. A mesa sai da foto. |
| Cancelar a venda | O pedido vira Cancelado e ganha itens_cancelados | A venda vira CANCELLED, os lançamentos dela são apagados e o cancelamento fica registrado. O estoque não volta (pergunta 9). Caixa conferido não é mexido. |
| Sangria, suprimento, despesa ou vale | caixa_transacoes | Um lançamento do caixa, com o mesmo código |
| Fechar o caixa | O caixa vira Fechado | O caixa vira PENDING. Depois a Conferência marca CHECKED. |
| Delivery baixado no PDV | O pedido vira Fechado e ganha pagamentos | Hoje: muda o status do pedido e às vezes sobe como venda. Pela decisão R2: sobe como venda do caixa que deu a baixa, uma vez só na Conferência. |

## Notas

Regras e decisões do caixa e da sincronia: skill metrics-regras-negocio e Metrics.PDV/docs/CAIXA-E-SINCRONIA-PDV-X-CONFERENCIA.md.

## Pendências e decisões

- Rodar npm run migrate:all antes de publicar o backend 2.6.89.
- Vendas e baixas de estoque recebidas antes do 2.6.89 não têm sale_item_id: o estorno do cancelamento só vale para as novas.
- Fiado (pergunta 5) e vale do funcionário (pergunta 4).
- Módulo Vendas (16/10/2026): rodar a migration 20261016220000_modulo_vendas (Sincronizar no SaaS Admin) logo depois de publicar a nuvem; até rodar, a subida de vendas do PDV dá erro e o PDV tenta de novo depois (nada se perde). O troco não sobe do PDV (o detalhe mostra "—").
