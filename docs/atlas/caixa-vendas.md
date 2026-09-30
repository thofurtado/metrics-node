# Caixa e vendas

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/caixa-vendas.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

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
- **O que é:** Uma venda fechada no PDV: balcão, mesa ou salão. Tem o mesmo código do pedido no PDV. Guarda total, desconto, situação, origem, a mesa ou comanda de onde veio, frete, taxa de serviço e couvert.
- **Quem grava:** O PDV, na hora do pagamento e no ciclo de 5 minutos. A nuvem recusa com motivo venda sem caixa, de caixa desconhecido ou de caixa conferido.
- **Quem lê:** Custo da mercadoria vendida (CMV) e os relatórios que vão ser feitos.
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
