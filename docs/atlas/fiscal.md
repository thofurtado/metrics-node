# Fiscal (NFC-e)

> Gerado por `atlas.py` em 08/10/2026 a partir do código e de `modulos/fiscal.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

A NFC-e é emitida só pelo PDV: o XML de cada nota, a inutilização de numeração e a tabela do IBPT (valor aproximado dos tributos) ficam no banco local. Os dados fiscais do produto (NCM, CFOP, CSOSN) ficam no cardápio.

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
