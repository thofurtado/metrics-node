# Fiscal (NFC-e)

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/fiscal.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

A NFC-e é emitida só pelo PDV: o XML de cada nota, a inutilização de numeração e a tabela do IBPT (valor aproximado dos tributos) ficam no banco local. Os dados fiscais do produto (NCM, CFOP, CSOSN) ficam no cardápio.

## Trabalhos que rodam o tempo todo

### TrayMonitor: painel aberto consulta a SEFAZ — Defeito
- **Frequência:** a cada 3 s, 4 rotas do Core Service
- **Onde roda:** Computador da loja com o painel do TrayMonitor aberto → `Core Service local; /api/fiscal/status consulta a SEFAZ a cada chamada`
- **Quantos:** 1 por painel aberto
- **A cada vez:** Consulta a SEFAZ a cada 3 s sem o limite de 3 min que o PDV respeita: risco de rejeição 656 (consumo indevido), que bloqueia a emissão por um tempo.
- **Por que existe:** Mostrar a situação do serviço, da nota e das impressoras no painel.
- **Proposta:** Guardar a resposta da SEFAZ por 3 min (como o PDV) e o painel a cada 10-15 s.
- **Onde no código:** `Metrics.PDV/Metrics.TrayMonitor/MainWindow.xaml.cs:72`, `Metrics.PDV/Metrics.CoreService/Program.cs:423`

### Verificação ao vivo (SEFAZ e certificado) — Ok
- **Frequência:** itens locais a cada 10 s; SEFAZ a cada 15 min (3 min na tela de entrada)
- **Onde roda:** Todo PDV aberto → `SEFAZ (com limite)`
- **Por que existe:** Avisar antes da venda se a SEFAZ está fora ou o certificado venceu.
- **Onde no código:** `Metrics.PDV/Metrics.PDV/Services/VerificacaoAoVivo.cs:138`

### Contingência da NFC-e — Ok
- **Frequência:** a cada 30 s; SEFAZ só se houver nota pendente
- **Onde roda:** Core Service do servidor da loja → `Banco da loja; SEFAZ só com pendência`
- **Por que existe:** Transmitir as notas emitidas em contingência assim que a SEFAZ volta.
- **Onde no código:** `Metrics.PDV/Metrics.CoreService/ContingencyWatcherBackgroundService.cs:31`

### Tabela de impostos aproximados (IBPT) — Ok
- **Frequência:** no máximo a cada 6 h (30 min se faltar algum NCM)
- **Onde roda:** Core Service do computador servidor da loja (sincronia geral) → `Nuvem: GET /api/pdv/sync/ibpt (lotes de 100)`
- **Por que existe:** Imposto aproximado no cupom (Lei da Transparência).
- **Onde no código:** `Metrics.PDV/Metrics.Shared/Services/Fiscal/IbptAtualizacaoService.cs:88`

## Tabelas e Estrutura de Dados

### XML da NFC-e (`nfce_documentos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia do XML de cada nota (autorizada, contingência, cancelamento). O arquivo também fica em C:\ProgramData\Metrics.PDV\nfce.
- **Quem lê:** Reimpressão, ZIP para o contador.

### Inutilização (`nfce_inutilizacoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Faixas de numeração da NFC-e inutilizadas na SEFAZ.

### Tabela do IBPT (`ibpt_tabela`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Percentual aproximado de tributos por NCM, importado do CSV oficial do IBPT (um por estado). Cada importação troca a tabela inteira.
- **Cresce:** Milhares de linhas, substituídas a cada importação.

### Contador da NFC-e (`contador_nfce`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** O último número de NFC-e usado, uma linha por ambiente (P = produção, H = homologação) e série. Cada venda que vai virar nota pega o próximo número daqui, na mesma transação que grava o número no pedido: nenhum número se repete nem fica pulado quando a gravação falha (era o problema da sequência antiga do PostgreSQL).
- **Quem grava:** PDV, ao reservar o número da nota da venda (NfceNumeracao). O preparo do banco do servidor cria a tabela; na troca de servidor, o resgate das vendas leva o maior número para o servidor novo (nunca volta atrás).
- **Quem lê:** PDV, ao emitir a NFC-e e ao conferir a numeração.
- **Cresce:** Não cresce: 1 a 2 linhas (produção e homologação, série 1).

## Pendências e decisões

- A nota não sobe para a nuvem: a venda da nuvem não guarda chave nem número da NFC-e.
